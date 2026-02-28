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
	sessions *SessionStore
	upgrader websocket.Upgrader
}

func NewSignalHandler(ss *SessionStore) *SignalHandler {
	return &SignalHandler{
		sessions: ss,
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

	if c.sessionID == "" {
		return nil
	}

	sess, err := sh.sessions.Get(c.sessionID)
	if err != nil {
		return err
	}
	sess.RemoveClient(c)
	// close the session if hosting
	if sess.Host == c.ID {
		sess.ForEachClient(func(client *Client) {
			client.sessionID = ""
			err := client.send(Message{
				Type: "message",
				Body: MessageBody{
					Type:    SignalSessionLeft,
					Payload: sess,
				}})
			if err != nil {
				log.Printf("write json: %v", err)
			}
		})
		sh.sessions.Delete(sess.ID)
		return nil
	}

	if len(sess.Clients) == 0 {
		return nil
	}

	if err := sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalClientLeft,
			Payload: c,
		},
	}, sess.ID); err != nil {
		return fmt.Errorf("broadcast client-left: %v", err)
	}

	err = sh.broadcast(c.conn, Message{Type: "message",
		Body: MessageBody{
			Type:    SignalSessionInfo,
			Payload: sess,
		},
	}, sess.ID)
	if err != nil {
		return fmt.Errorf("broadcast session-info: %v", err)
	}

	return nil
}

func (sh *SignalHandler) broadcast(sender *websocket.Conn, json Message, sessionID string) error {
	sess, err := sh.sessions.Get(sessionID)
	if err != nil {
		return err
	}

	sess.ForEachClient(func(client *Client) {
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
	case SignalRequestSession:
		return sh.handleRequestSession(c, msg)
	case SignalJoinSession:
		return sh.handleJoinSession(c, msg)
	case SignalLeaveSession:
		return sh.handleLeaveSession(c, msg)
	case SignalAnswer, SignalOffer, SignalICECandidate:
		return sh.handleWebRTCMessage(msg)
	default:
		return ErrUnknownMessageType
	}
}

func (sh *SignalHandler) handleRequestSession(c *Client, msg Message) error {
	sess, err := sh.sessions.Create(c.ID)
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
			Type:    SignalSessionCreated,
			Payload: sess,
		},
	})
}

func (sh *SignalHandler) handleJoinSession(c *Client, msg Message) error {
	var payload SessionIDPayload
	bytes, err := json.Marshal(msg.Body.Payload)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return err
	}

	sess, err := sh.sessions.Get(payload.SessionID)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return c.send(Message{
				Transaction: msg.Transaction,
				Type:        "response",
				Body: MessageBody{
					Type: SignalSessionNotFound,
					Payload: SessionIDPayload{
						SessionID: payload.SessionID,
					},
				},
			})
		}
		return err
	}

	// leave previous session in case the client hasn't done it already
	if c.sessionID != "" {
		sess, err := sh.sessions.Get(c.sessionID)
		sess.RemoveClient(c)
		if err == nil {
			err = sh.broadcast(c.conn, Message{
				Type: "message",
				Body: MessageBody{
					Type:    SignalClientLeft,
					Payload: c,
				}}, sess.ID)
			if err != nil {
				log.Printf("join session: failed to broadcast to previous session: %v", err)
			}
		}
	}

	if err := sess.AddClient(c); err != nil {
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
			Type:    SignalSessionJoined,
			Payload: sess,
		}}); err != nil {
		return err
	}

	if err := sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalSessionInfo,
			Payload: sess,
		},
	}, sess.ID); err != nil {
		return err
	}

	return sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalClientJoined,
			Payload: c,
		},
	}, sess.ID)
}

func (sh *SignalHandler) handleLeaveSession(c *Client, msg Message) error {
	var payload SessionIDPayload
	bytes, err := json.Marshal(msg.Body.Payload)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return err
	}

	sess, err := sh.sessions.Get(payload.SessionID)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return c.send(Message{
				Transaction: msg.Transaction,
				Type:        "response",
				Body: MessageBody{
					Type: SignalSessionNotFound,
					Payload: SessionIDPayload{
						SessionID: payload.SessionID,
					},
				},
			})
		}
		return err
	}

	sess.RemoveClient(c)
	if err := c.send(Message{
		Transaction: msg.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type:    SignalSessionLeft,
			Payload: sess,
		},
	}); err != nil {
		return err
	}

	if sess.Host == c.ID {
		sess.ForEachClient(func(client *Client) {
			client.sessionID = ""
			err := client.send(Message{
				Type: "message",
				Body: MessageBody{
					Type:    SignalSessionLeft,
					Payload: sess,
				},
			})
			if err != nil {
				log.Printf("write json: %v", err)
			}
		})
		sh.sessions.Delete(sess.ID)
		return nil
	}

	if err := sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalSessionInfo,
			Payload: sess,
		},
	}, sess.ID); err != nil {
		return err
	}

	return sh.broadcast(c.conn, Message{
		Type: "message",
		Body: MessageBody{
			Type:    SignalClientLeft,
			Payload: c,
		},
	}, sess.ID)
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

	sess, err := sh.sessions.Get(info.SessionID)
	if err != nil {
		return err
	}

	var recipient *Client
	for _, c := range sess.Clients {
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
