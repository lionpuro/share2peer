package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

type SignalHandler struct {
	rooms    *RoomStore
	upgrader websocket.Upgrader
}

func NewSignalHandler(rs *RoomStore) *SignalHandler {
	return &SignalHandler{
		rooms: rs,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (sh *SignalHandler) serve(conn *websocket.Conn, header http.Header) error {
	ci := extractClientInfo(header.Get("User-Agent"))
	c := createClient(conn, ci.deviceType, ci.deviceName)
	log.Printf("connect client: %s", c.ID)
	defer func() {
		if err := sh.disconnect(c); err != nil {
			log.Printf("disconnect: %v", err)
		}
	}()

	if err := c.send(Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalIdentity,
			Payload: c,
		}}); err != nil {
		return err
	}

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				return fmt.Errorf("read message: %v", err)
			}
			return nil
		}

		var message Message
		if err := json.Unmarshal(msg, &message); err != nil {
			log.Printf("unmarshal message: %s", err.Error())
			continue
		}

		if err := sh.handleMessage(c, message); err != nil {
			return err
		}
	}
}

func (sh *SignalHandler) disconnect(c *Client) error {
	defer func() {
		if err := c.conn.Close(); err != nil {
			log.Printf("close connection: %v", err)
		}
		log.Printf("disconnect client: %s", c.ID)
	}()

	if c.roomID == "" {
		return nil
	}

	room, err := sh.rooms.Get(c.roomID)
	if err != nil {
		return err
	}
	room.RemoveClient(c)
	// close the room if hosting
	if room.Host == c.ID {
		room.ForEachClient(func(client *Client) {
			client.roomID = ""
			err := client.send(Message{
				Type: "message",
				Body: MessageBody{
					Type:    SignalRoomLeft,
					Payload: room,
				}})
			if err != nil {
				log.Printf("write json: %v", err)
			}
		})
		sh.rooms.Delete(room.ID)
		return nil
	}

	if len(room.Clients) == 0 {
		return nil
	}

	if err := sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalClientLeft,
			Payload: c,
		},
	}, room.ID); err != nil {
		return fmt.Errorf("broadcast client-left: %v", err)
	}

	err = sh.broadcast(c.conn, Message{Type: "message",
		Body: MessageBody{
			Type:    SignalRoomInfo,
			Payload: room,
		},
	}, room.ID)
	if err != nil {
		return fmt.Errorf("broadcast room-info: %v", err)
	}

	return nil
}

func (sh *SignalHandler) broadcast(sender *websocket.Conn, json Message, roomID string) error {
	room, err := sh.rooms.Get(roomID)
	if err != nil {
		return err
	}

	room.ForEachClient(func(client *Client) {
		if client.conn == sender {
			return
		}
		if err := client.send(json); err != nil {
			log.Printf("write json: %s", err.Error())
		}
	})

	return nil
}

func (sh *SignalHandler) handleMessage(c *Client, msg Message) error {
	switch msg.Body.Type {
	case SignalCreateRoom:
		return sh.handleCreateRoom(c, msg)
	case SignalJoinRoom:
		return sh.handleJoinRoom(c, msg)
	case SignalLeaveRoom:
		return sh.handleLeaveRoom(c, msg)
	case SignalAnswer, SignalOffer, SignalICECandidate:
		return sh.handleWebRTCMessage(msg)
	default:
		return ErrUnknownMessageType
	}
}

func (sh *SignalHandler) handleCreateRoom(c *Client, msg Message) error {
	room, err := sh.rooms.Create(c.ID)
	if err != nil {
		return c.send(Message{
			Transaction: msg.Transaction,
			Type:        "response",
			Body: MessageBody{
				Type: SignalError,
				Payload: ErrorPayload{
					Code:    ErrCodeServerError,
					Message: "Server error",
				},
			},
		})
	}

	return c.send(Message{
		Transaction: msg.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type:    SignalRoomCreated,
			Payload: room,
		},
	})
}

func (sh *SignalHandler) handleJoinRoom(c *Client, msg Message) error {
	var payload RoomIDPayload
	bytes, err := json.Marshal(msg.Body.Payload)
	if err != nil {
		return c.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return c.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}

	room, err := sh.rooms.Get(payload.RoomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			return c.send(Message{
				Transaction: msg.Transaction,
				Type:        "response",
				Body: MessageBody{
					Type: SignalError,
					Payload: ErrorPayload{
						Code:    ErrCodeNotFound,
						Message: "Room not found",
					},
				},
			})
		}
		return err
	}

	// leave previous room in case the client hasn't done it already
	if c.roomID != "" {
		room, err := sh.rooms.Get(c.roomID)
		room.RemoveClient(c)
		if err == nil {
			err = sh.broadcast(c.conn, Message{
				Type: "message",
				Body: MessageBody{
					Type:    SignalClientLeft,
					Payload: c,
				}}, room.ID)
			if err != nil {
				log.Printf("join room: failed to broadcast to previous room: %v", err)
			}
		}
	}

	if err := room.AddClient(c); err != nil {
		return c.send(Message{
			Transaction: msg.Transaction,
			Type:        "response",
			Body: MessageBody{
				Type: SignalError,
				Payload: ErrorPayload{
					Code:    ErrCodeServerError,
					Message: "Server error",
				},
			}})
	}

	if err := c.send(Message{
		Transaction: msg.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type:    SignalRoomJoined,
			Payload: room,
		}}); err != nil {
		return err
	}

	if err := sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalRoomInfo,
			Payload: room,
		},
	}, room.ID); err != nil {
		return err
	}

	return sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalClientJoined,
			Payload: c,
		},
	}, room.ID)
}

func (sh *SignalHandler) handleLeaveRoom(c *Client, msg Message) error {
	var payload RoomIDPayload
	bytes, err := json.Marshal(msg.Body.Payload)
	if err != nil {
		return c.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return c.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}

	room, err := sh.rooms.Get(payload.RoomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			return c.send(Message{
				Transaction: msg.Transaction,
				Type:        "response",
				Body: MessageBody{
					Type: SignalError,
					Payload: ErrorPayload{
						Code:    ErrCodeNotFound,
						Message: "Room not found",
					},
				},
			})
		}
		return err
	}

	room.RemoveClient(c)
	if err := c.send(Message{
		Transaction: msg.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type:    SignalRoomLeft,
			Payload: room,
		},
	}); err != nil {
		return err
	}

	if room.Host == c.ID {
		room.ForEachClient(func(client *Client) {
			client.roomID = ""
			err := client.send(Message{
				Type: "message",
				Body: MessageBody{
					Type:    SignalRoomLeft,
					Payload: room,
				},
			})
			if err != nil {
				log.Printf("write json: %v", err)
			}
		})
		sh.rooms.Delete(room.ID)
		return nil
	}

	if err := sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalRoomInfo,
			Payload: room,
		},
	}, room.ID); err != nil {
		return err
	}

	return sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalClientLeft,
			Payload: c,
		},
	}, room.ID)
}

func (sh *SignalHandler) handleWebRTCMessage(msg Message) error {
	var info RTCMessageInfo
	bytes, err := json.Marshal(msg.Body.Payload)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bytes, &info); err != nil {
		return err
	}

	room, err := sh.rooms.Get(info.RoomID)
	if err != nil {
		return err
	}

	var recipient *Client
	for _, c := range room.Clients {
		if c.ID.String() == info.To {
			recipient = c
		}
	}
	if recipient == nil {
		log.Printf("webrtc: message recipient not found")
		return nil
	}

	return recipient.send(msg)
}
