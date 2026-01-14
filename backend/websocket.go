package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WebSocketHandler struct {
	sessions *SessionStore
}

func (wh *WebSocketHandler) handleWebSocket(conn *websocket.Conn, header http.Header) error {
	ci := extractClientInfo(header.Get("User-Agent"))
	c := createClient(conn, ci.deviceType, ci.deviceName)
	log.Printf("connect client: %s", c.ID)
	defer func() {
		defer func() {
			if err := conn.Close(); err != nil {
				log.Printf("close connection: %v", err)
			}
			log.Printf("disconnect client: %s", c.ID)
		}()

		if c.sessionID == "" {
			return
		}

		sess, err := wh.sessions.Get(c.sessionID)
		if err != nil {
			return
		}
		sess.RemoveClient(c)
		// close the session if hosting
		if sess.Host == c.ID {
			sess.ForEachClient(func(client *Client) {
				client.sessionID = ""
				err := client.send(Message{
					Type:    MessageSessionLeft,
					Payload: sess,
				})
				if err != nil {
					log.Printf("write json: %v", err)
				}
			})
			wh.sessions.Delete(sess.ID)
			return
		}

		if err := wh.broadcast(c.conn, Message{
			Type:    MessageClientLeft,
			Payload: c,
		}, sess.ID); err != nil {
			log.Printf("broadcast message: %v", err)
		}

		err = wh.broadcast(conn, Message{
			Type:    MessageSessionInfo,
			Payload: sess,
		}, sess.ID)
		if err != nil {
			log.Printf("broadcast message: %v", err)
		}
	}()

	if err := c.send(Message{
		Type:    MessageIdentity,
		Payload: c,
	}); err != nil {
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

		if err := wh.handleResponse(c, message); err != nil {
			return err
		}
	}
}

func (wh *WebSocketHandler) broadcast(sender *websocket.Conn, json interface{}, sessionID string) error {
	sess, err := wh.sessions.Get(sessionID)
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

func (wh *WebSocketHandler) handleResponse(c *Client, msg Message) error {
	switch msg.Type {
	case MessageRequestSession:
		return wh.handleRequestSession(c)
	case MessageJoinSession:
		return wh.handleJoinSession(c, msg)
	case MessageLeaveSession:
		return wh.handleLeaveSession(c, msg)
	case MessageAnswer, MessageOffer, MessageICECandidate:
		return wh.handleWebRTCMessage(msg)
	default:
		return ErrUnknownMessageType
	}
}

func (wh *WebSocketHandler) handleRequestSession(c *Client) error {
	sess, err := wh.sessions.Create(c.ID)
	if err != nil {
		return err
	}

	return c.send(Message{
		Type:    MessageSessionCreated,
		Payload: sess,
	})
}

func (wh *WebSocketHandler) handleJoinSession(c *Client, msg Message) error {
	var payload SessionIDPayload
	bytes, err := json.Marshal(msg.Payload)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return err
	}

	sess, err := wh.sessions.Get(payload.SessionID)
	if err != nil {
		if !errors.Is(err, ErrSessionNotFound) {
			return err
		}
		return c.send(Message{
			Type: MessageError,
			Payload: ErrorPayload{
				Code:    ErrCodeSessionNotFound,
				Message: ErrSessionNotFound.Error(),
			},
		})
	}

	// leave previous session in case the client hasn't done it already
	if c.sessionID != "" {
		sess, err := wh.sessions.Get(c.sessionID)
		sess.RemoveClient(c)
		if err == nil {
			err = wh.broadcast(c.conn, Message{
				Type:    MessageClientLeft,
				Payload: c,
			}, sess.ID)
			if err != nil {
				log.Printf("join session: failed to broadcast to previous session: %v", err)
			}
		}
	}

	if err := sess.AddClient(c); err != nil {
		return err
	}

	err = c.send(Message{
		Type:    MessageSessionJoined,
		Payload: sess,
	})
	if err != nil {
		return err
	}

	if err := wh.broadcast(c.conn, Message{
		Type:    MessageSessionInfo,
		Payload: sess,
	}, sess.ID); err != nil {
		return err
	}

	return wh.broadcast(c.conn, Message{
		Type:    MessageClientJoined,
		Payload: c,
	}, sess.ID)
}

func (wh *WebSocketHandler) handleLeaveSession(c *Client, msg Message) error {
	var payload SessionIDPayload
	bytes, err := json.Marshal(msg.Payload)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return err
	}

	sess, err := wh.sessions.Get(payload.SessionID)
	if err != nil {
		if !errors.Is(err, ErrSessionNotFound) {
			return err
		}
		return c.send(Message{
			Type: MessageError,
			Payload: ErrorPayload{
				Code:    ErrCodeSessionNotFound,
				Message: ErrSessionNotFound.Error(),
			},
		})
	}

	sess.RemoveClient(c)
	if err := c.send(Message{
		Type:    MessageSessionLeft,
		Payload: sess,
	}); err != nil {
		return err
	}

	if sess.Host == c.ID {
		sess.ForEachClient(func(client *Client) {
			client.sessionID = ""
			err := client.send(Message{
				Type:    MessageSessionLeft,
				Payload: sess,
			})
			if err != nil {
				log.Printf("write json: %v", err)
			}
		})
		wh.sessions.Delete(sess.ID)
		return nil
	}

	if err := wh.broadcast(c.conn, Message{
		Type:    MessageSessionInfo,
		Payload: sess,
	}, sess.ID); err != nil {
		return err
	}

	return wh.broadcast(c.conn, Message{
		Type:    MessageClientLeft,
		Payload: c,
	}, sess.ID)
}

func (wh *WebSocketHandler) handleWebRTCMessage(msg Message) error {
	var info RTCMessageInfo
	bytes, err := json.Marshal(msg.Payload)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bytes, &info); err != nil {
		return err
	}

	sess, err := wh.sessions.Get(info.SessionID)
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
