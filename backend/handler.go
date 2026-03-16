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
	users    *UserService
	rooms    *RoomStore
	upgrader websocket.Upgrader
}

func NewSignalHandler(us *UserService, rs *RoomStore) *SignalHandler {
	return &SignalHandler{
		users: us,
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
	u := createUser(conn, ci.deviceType, ci.deviceName)
	sh.users.Register(u)
	log.Printf("connect user: %s", u.ID)
	defer func() {
		if err := sh.disconnect(u); err != nil {
			log.Printf("disconnect: %v", err)
		}
	}()

	if err := u.send(Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalIdentity,
			Payload: u,
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

		if err := sh.handleMessage(u, message); err != nil {
			return err
		}
	}
}

func (sh *SignalHandler) disconnect(u *User) error {
	defer func() {
		if err := u.conn.Close(); err != nil {
			log.Printf("close connection: %v", err)
		}
		sh.users.Delete(u.ID)
		log.Printf("disconnect user: %s", u.ID)
	}()

	if u.roomID == "" {
		return nil
	}

	room, err := sh.rooms.Get(u.roomID)
	if err != nil {
		return err
	}
	room.RemoveUser(u)
	// close the room if hosting
	if room.Host == u.ID {
		room.ForEachUser(func(user *User) {
			user.roomID = ""
			err := user.send(Message{
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

	if len(room.Users) == 0 {
		return nil
	}

	if err := sh.broadcast(u.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalUserLeft,
			Payload: u,
		},
	}, room.ID); err != nil {
		return fmt.Errorf("broadcast user-left: %v", err)
	}

	err = sh.broadcast(u.conn, Message{Type: "message",
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

	room.ForEachUser(func(user *User) {
		if user.conn == sender {
			return
		}
		if err := user.send(json); err != nil {
			log.Printf("write json: %s", err.Error())
		}
	})

	return nil
}

func (sh *SignalHandler) handleMessage(u *User, msg Message) error {
	switch msg.Body.Type {
	case SignalCreateRoom:
		return sh.handleCreateRoom(u, msg)
	case SignalJoinRoom:
		return sh.handleJoinRoom(u, msg)
	case SignalLeaveRoom:
		return sh.handleLeaveRoom(u, msg)
	case SignalAnswer, SignalOffer, SignalICECandidate:
		return sh.handleWebRTCMessage(msg)
	default:
		return ErrUnknownMessageType
	}
}

func (sh *SignalHandler) handleCreateRoom(u *User, msg Message) error {
	room, err := sh.rooms.Create(u.ID)
	if err != nil {
		return u.send(Message{
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

	return u.send(Message{
		Transaction: msg.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type:    SignalRoomCreated,
			Payload: room,
		},
	})
}

func (sh *SignalHandler) handleJoinRoom(u *User, msg Message) error {
	var payload RoomIDPayload
	bytes, err := json.Marshal(msg.Body.Payload)
	if err != nil {
		return u.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return u.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}

	room, err := sh.rooms.Get(payload.RoomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			return u.send(Message{
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

	// leave previous room in case the user hasn't done it already
	if u.roomID != "" {
		room, err := sh.rooms.Get(u.roomID)
		room.RemoveUser(u)
		if err == nil {
			err = sh.broadcast(u.conn, Message{
				Type: "message",
				Body: MessageBody{
					Type:    SignalUserLeft,
					Payload: u,
				}}, room.ID)
			if err != nil {
				log.Printf("join room: failed to broadcast to previous room: %v", err)
			}
		}
	}

	if err := room.AddUser(u); err != nil {
		return u.send(Message{
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

	if err := u.send(Message{
		Transaction: msg.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type:    SignalRoomJoined,
			Payload: room,
		}}); err != nil {
		return err
	}

	if err := sh.broadcast(u.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalRoomInfo,
			Payload: room,
		},
	}, room.ID); err != nil {
		return err
	}

	return sh.broadcast(u.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalUserJoined,
			Payload: u,
		},
	}, room.ID)
}

func (sh *SignalHandler) handleLeaveRoom(u *User, msg Message) error {
	var payload RoomIDPayload
	bytes, err := json.Marshal(msg.Body.Payload)
	if err != nil {
		return u.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return u.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}

	room, err := sh.rooms.Get(payload.RoomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			return u.send(Message{
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

	room.RemoveUser(u)
	if err := u.send(Message{
		Transaction: msg.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type:    SignalRoomLeft,
			Payload: room,
		},
	}); err != nil {
		return err
	}

	if room.Host == u.ID {
		room.ForEachUser(func(user *User) {
			user.roomID = ""
			err := user.send(Message{
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

	if err := sh.broadcast(u.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalRoomInfo,
			Payload: room,
		},
	}, room.ID); err != nil {
		return err
	}

	return sh.broadcast(u.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalUserLeft,
			Payload: u,
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

	var recipient *User
	for _, u := range room.Users {
		if u.ID.String() == info.To {
			recipient = u
		}
	}
	if recipient == nil {
		log.Printf("webrtc: message recipient not found")
		return nil
	}

	return recipient.send(msg)
}
