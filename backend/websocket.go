package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/mileusna/useragent"
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
	ua := useragent.Parse(header.Get("User-Agent"))
	t, n := deviceInfo(ua)
	c := createClient(conn, t, n)
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
				err := client.conn.WriteJSON(Message{
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
		err = wh.broadcast(conn, Message{
			Type:    MessageSessionInfo,
			Payload: sess,
		}, c.sessionID)
		if err != nil {
			log.Printf("broadcast message: %v", err)
		}
	}()

	if err := conn.WriteJSON(Message{
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
		if err := client.conn.WriteJSON(json); err != nil {
			log.Printf("write json: %s", err.Error())
		}
	})

	return nil
}

func (wh *WebSocketHandler) handleResponse(c *Client, msg Message) error {
	switch msg.Type {
	case MessageRequestSession:
		return wh.handleRequestSession(c, msg)
	case MessageJoinSession:
		return wh.handleJoinSession(c, msg)
	case MessageLeaveSession:
		return wh.handleLeaveSession(c, msg)
	case MessageAnswer, MessageOffer, MessageICECandidate:
		return wh.handleWebRTCMessage(c, msg)
	default:
		return ErrUnknownMessageType
	}
}

func (wh *WebSocketHandler) handleRequestSession(c *Client, msg Message) error {
	sess, err := wh.sessions.Create(c.ID)
	if err != nil {
		return err
	}

	return c.conn.WriteJSON(Message{
		Type:    MessageSessionCreated,
		Payload: SessionIDPayload{SessionID: sess.ID},
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
		return c.conn.WriteJSON(Message{
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
		if !errors.Is(err, ErrSessionFull) {
			return err
		}
		for _, cl := range sess.Clients {
			if cl.conn == c.conn {
				return c.conn.WriteJSON(Message{
					Type:    MessageSessionJoined,
					Payload: sess,
				})
			}
		}
		return c.conn.WriteJSON(Message{
			Type: MessageError,
			Payload: ErrorPayload{
				Code:    ErrCodeSessionFull,
				Message: ErrSessionFull.Error(),
			},
		})
	}

	err = c.conn.WriteJSON(Message{
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
		return c.conn.WriteJSON(Message{
			Type: MessageError,
			Payload: ErrorPayload{
				Code:    ErrCodeSessionNotFound,
				Message: ErrSessionNotFound.Error(),
			},
		})
	}

	sess.RemoveClient(c)
	if err := c.conn.WriteJSON(Message{
		Type:    MessageSessionLeft,
		Payload: sess,
	}); err != nil {
		return err
	}

	if sess.Host == c.ID {
		sess.ForEachClient(func(client *Client) {
			client.sessionID = ""
			err := client.conn.WriteJSON(Message{
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

func (wh *WebSocketHandler) handleWebRTCMessage(c *Client, msg Message) error {
	var payload SessionIDPayload
	bytes, err := json.Marshal(msg.Payload)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return err
	}

	return wh.broadcast(c.conn, msg, c.sessionID)
}
