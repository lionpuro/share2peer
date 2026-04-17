package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

type SignalHandler struct {
	users    *UserService
	rooms    *RoomService
	upgrader websocket.Upgrader
}

func NewSignalHandler(origins string, us *UserService, rs *RoomService) *SignalHandler {
	return &SignalHandler{
		users: us,
		rooms: rs,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				if origins == "*" {
					return true
				}
				origin := r.Header.Get("Origin")
				for _, o := range strings.Split(origins, ",") {
					if origin == o {
						return true
					}
				}
				return false
			},
		},
	}
}

func (h *SignalHandler) serve(conn *websocket.Conn, req *http.Request) error {
	u := createUser(conn, extractClientInfo(req))
	h.users.Register(u)
	log.Printf("connect user: %s", u.ID)
	defer func() {
		if err := h.disconnect(u); err != nil {
			log.Printf("disconnect: %v", err)
		}
	}()

	if err := u.send(Message{
		Type:    SignalIdentity,
		Payload: u,
	}); err != nil {
		return err
	}

	if err := broadcastNetworkUsers(nil, h.users.FindByNetwork(u.networkKey)); err != nil {
		return err
	}

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if !isUnexpectedCloseError(err) {
				return nil
			}
			return fmt.Errorf("read message: %v", err)
		}

		var message Message
		if err := json.Unmarshal(msg, &message); err != nil {
			log.Printf("unmarshal message: %s", err.Error())
			continue
		}

		if err := h.handleMessage(u, message); err != nil {
			if !isUnexpectedCloseError(err) {
				return nil
			}
			return err
		}
	}
}

func (h *SignalHandler) disconnect(u *User) error {
	defer func() {
		if err := u.conn.Close(); err != nil {
			log.Printf("close connection: %v", err)
		}
		h.users.Delete(u.ID)
		users := h.users.FindByNetwork(u.networkKey)
		if err := broadcastNetworkUsers(nil, users); err != nil {
			log.Printf("broadcast network users: %v", err)
		}
		log.Printf("disconnect user: %s", u.ID)
	}()

	if u.roomID == "" {
		return nil
	}

	roomID := u.roomID
	room, err := h.rooms.RemoveUser(roomID, u)
	if err != nil {
		if !errors.Is(err, ErrRoomNotFound) {
			return err
		}
		return nil
	}

	if err := h.broadcast(u.conn, Message{
		Type:    SignalUserLeft,
		Payload: u,
	}, roomID); err != nil {
		return fmt.Errorf("broadcast user-left: %v", err)
	}

	if err := h.broadcast(u.conn, Message{
		Type:    SignalRoomInfo,
		Payload: room,
	}, roomID); err != nil {
		return fmt.Errorf("broadcast room-info: %v", err)
	}

	return nil
}

func (h *SignalHandler) broadcast(sender *websocket.Conn, json Message, roomID string) error {
	room, err := h.rooms.Get(roomID)
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

func (h *SignalHandler) handleMessage(u *User, msg Message) error {
	switch msg.Type {
	case SignalInviteToRoom:
		return h.handleInviteToRoom(u, msg)
	case SignalCreateRoom:
		return h.handleCreateRoom(u, msg)
	case SignalJoinRoom:
		return h.handleJoinRoom(u, msg)
	case SignalLeaveRoom:
		return h.handleLeaveRoom(u, msg)
	case SignalAnswer, SignalOffer, SignalICECandidate:
		return h.handleWebRTCMessage(msg)
	case SignalPing:
		return nil
	default:
		return ErrUnknownMessageType
	}
}

func (h *SignalHandler) handleInviteToRoom(u *User, msg Message) error {
	payload, err := unmarshal[InviteToRoomPayload](msg.Payload)
	if err != nil {
		return u.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}

	to, ok := h.users.FindByID(payload.UserID)
	if !ok {
		return nil
	}
	if to.networkKey != u.networkKey {
		return nil
	}

	return to.send(Message{
		Type: SignalRoomInvitation,
		Payload: map[string]any{
			"from":    u,
			"room_id": payload.RoomID,
		},
	})
}

func (h *SignalHandler) handleCreateRoom(u *User, msg Message) error {
	room, err := h.rooms.Create()
	if err != nil {
		return u.send(Message{
			Transaction: msg.Transaction,
			Type:        SignalError,
			Payload: ErrorPayload{
				Code:    ErrCodeServerError,
				Message: "Server error",
			},
		})
	}

	return u.send(Message{
		Transaction: msg.Transaction,
		Type:        SignalRoomCreated,
		Payload:     room,
	})
}

func (h *SignalHandler) handleJoinRoom(u *User, msg Message) error {
	payload, err := unmarshal[RoomIDPayload](msg.Payload)
	if err != nil {
		return u.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}

	room, err := h.rooms.Get(payload.RoomID)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			return u.send(Message{
				Transaction: msg.Transaction,
				Type:        SignalError,
				Payload: ErrorPayload{
					Code:    ErrCodeNotFound,
					Message: "Room not found",
				},
			})
		}
		return err
	}

	// leave previous room in case the user hasn't done it already
	if u.roomID != "" {
		room, err := h.rooms.Get(u.roomID)
		if err == nil {
			room.RemoveUser(u)
			if err := h.broadcast(u.conn, Message{
				Type:    SignalUserLeft,
				Payload: u,
			}, room.ID); err != nil {
				log.Printf("join room: failed to broadcast to previous room: %v", err)
			}
			if err := h.broadcast(u.conn, Message{
				Type:    SignalRoomInfo,
				Payload: room,
			}, room.ID); err != nil {
				log.Printf("join room: failed to broadcast to previous room: %v", err)
			}
		}
	}

	room.AddUser(u)

	if err := u.send(Message{
		Transaction: msg.Transaction,
		Type:        SignalRoomJoined,
		Payload:     room,
	}); err != nil {
		return err
	}

	if err := h.broadcast(u.conn, Message{
		Type:    SignalRoomInfo,
		Payload: room,
	}, room.ID); err != nil {
		return err
	}

	if err := h.broadcast(u.conn, Message{
		Type:    SignalUserJoined,
		Payload: u,
	}, room.ID); err != nil {
		return err
	}

	return nil
}

func (h *SignalHandler) handleLeaveRoom(u *User, msg Message) error {
	payload, err := unmarshal[RoomIDPayload](msg.Payload)
	if err != nil {
		return u.send(createErrorResponse(msg, ErrCodeBadRequest, "Bad request"))
	}

	room, err := h.rooms.RemoveUser(payload.RoomID, u)
	if err != nil {
		if errors.Is(err, ErrRoomNotFound) {
			return u.send(Message{
				Transaction: msg.Transaction,
				Type:        SignalError,
				Payload: ErrorPayload{
					Code:    ErrCodeNotFound,
					Message: "Room not found",
				},
			})
		}
		return err
	}

	if err := u.send(Message{
		Transaction: msg.Transaction,
		Type:        SignalRoomLeft,
		Payload:     room,
	}); err != nil {
		return err
	}

	if err := h.broadcast(u.conn, Message{
		Type:    SignalRoomInfo,
		Payload: room,
	}, room.ID); err != nil {
		return err
	}

	return h.broadcast(u.conn, Message{
		Type:    SignalUserLeft,
		Payload: u,
	}, room.ID)
}

func (h *SignalHandler) handleWebRTCMessage(msg Message) error {
	info, err := unmarshal[RTCMessageInfo](msg.Payload)
	if err != nil {
		return err
	}

	room, err := h.rooms.Get(info.RoomID)
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

func broadcastNetworkUsers(to *User, users []*User) error {
	if to != nil {
		var peers = []*User{}
		for _, user := range users {
			if user.ID != to.ID {
				peers = append(peers, user)
			}
		}
		return to.send(Message{
			Type: SignalNetworkUsers,
			Payload: map[string]any{
				"users": peers,
			},
		})
	}

	for _, recipient := range users {
		var peers = []*User{}
		for _, user := range users {
			if user.ID != recipient.ID {
				peers = append(peers, user)
			}
		}
		err := recipient.send(Message{
			Type: SignalNetworkUsers,
			Payload: map[string]any{
				"users": peers,
			},
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func isUnexpectedCloseError(err error) bool {
	return websocket.IsUnexpectedCloseError(err,
		websocket.CloseGoingAway,
		websocket.CloseNoStatusReceived,
		websocket.CloseAbnormalClosure,
	)
}

func unmarshal[T any](input any) (T, error) {
	var result T
	bytes, err := json.Marshal(input)
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(bytes, &result); err != nil {
		return result, err
	}
	return result, err
}
