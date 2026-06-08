package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/gorilla/websocket"
)

type Hub struct {
	log        *slog.Logger
	users      *UserService
	rooms      *RoomService
	send       chan Message
	register   chan *User
	unregister chan *User
}

func newHub(log *slog.Logger, us *UserService, rs *RoomService) *Hub {
	return &Hub{
		log:        log,
		users:      us,
		rooms:      rs,
		send:       make(chan Message),
		register:   make(chan *User),
		unregister: make(chan *User),
	}
}

func (h *Hub) run() {
	for {
		select {
		case user := <-h.register:
			h.handleRegister(user)
		case user := <-h.unregister:
			h.handleUnregister(user)
		case msg := <-h.send:
			h.handleMessage(msg.user, msg)
		}
	}
}

func (h *Hub) handleRegister(u *User) {
	h.users.Add(u)
	u.send <- Message{
		Type:    SignalIdentity,
		Payload: u,
	}
	broadcastNetworkUsers(u, h.users.FindByNetwork(u.networkKey))
	h.log.Debug("connect user", "user", u)
}

func (h *Hub) handleUnregister(u *User) {
	defer func() {
		h.users.Delete(u.ID)
		users := h.users.FindByNetwork(u.networkKey)
		broadcastNetworkUsers(nil, users)
		h.log.Debug("disconnect user", "user", u)
		close(u.send)
	}()

	if u.roomID == "" {
		return
	}

	room, err := h.rooms.RemoveUser(u.roomID, u)
	if err != nil {
		return
	}

	users := room.ListUsers()
	broadcast(u, Message{
		Type:    SignalUserLeft,
		Payload: u,
	}, users)
	broadcast(u, Message{
		Type:    SignalRoomState,
		Payload: room,
	}, users)
}

func (h *Hub) handleMessage(user *User, msg Message) {
	switch msg.Type {
	case SignalInviteToRoom:
		payload, err := unmarshal[InviteToRoomPayload](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}
		to, ok := h.users.FindByID(payload.UserID)
		if !ok {
			return
		}
		if to.networkKey != user.networkKey {
			return
		}
		to.send <- Message{
			Type: SignalRoomInvitation,
			Payload: map[string]any{
				"from":    user,
				"room_id": payload.RoomID,
			},
		}

	case SignalCreateRoom:
		room, err := h.rooms.Create()
		if err != nil {
			user.send <- Message{
				Transaction: msg.Transaction,
				Type:        SignalError,
				Payload: ErrorPayload{
					Code:    ErrCodeServerError,
					Message: "Server error",
				},
			}
		}
		user.send <- Message{
			Transaction: msg.Transaction,
			Type:        SignalRoomCreated,
			Payload:     room,
		}

	case SignalJoinRoom:
		payload, err := unmarshal[RoomIDPayload](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}

		// leave previous room in case the client hasn't done it already
		if user.roomID != "" {
			if room, err := h.rooms.RemoveUser(user.roomID, user); err == nil {
				broadcast(user, Message{
					Type:    SignalUserLeft,
					Payload: user,
				}, room.Users)
				broadcast(user, Message{
					Type:    SignalRoomState,
					Payload: room,
				}, room.Users)
			}
		}

		room, err := h.rooms.AddUser(payload.RoomID, user)
		if err != nil {
			if errors.Is(err, ErrRoomNotFound) {
				user.send <- Message{
					Transaction: msg.Transaction,
					Type:        SignalError,
					Payload: ErrorPayload{
						Code:    ErrCodeNotFound,
						Message: "Room not found",
					},
				}
			}
			return
		}

		user.send <- Message{
			Transaction: msg.Transaction,
			Type:        SignalRoomJoined,
			Payload:     room,
		}
		broadcast(user, Message{
			Type:    SignalRoomState,
			Payload: room,
		}, room.Users)
		broadcast(user, Message{
			Type:    SignalUserJoined,
			Payload: user,
		}, room.Users)

	case SignalLeaveRoom:
		payload, err := unmarshal[RoomIDPayload](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}

		room, err := h.rooms.RemoveUser(payload.RoomID, user)
		if err != nil {
			if errors.Is(err, ErrRoomNotFound) {
				user.send <- Message{
					Transaction: msg.Transaction,
					Type:        SignalError,
					Payload: ErrorPayload{
						Code:    ErrCodeNotFound,
						Message: "Room not found",
					},
				}
			}
			return
		}

		user.send <- Message{
			Transaction: msg.Transaction,
			Type:        SignalRoomLeft,
			Payload:     room,
		}

		broadcast(user, Message{
			Type:    SignalRoomState,
			Payload: room,
		}, room.ListUsers())

		broadcast(user, Message{
			Type:    SignalUserLeft,
			Payload: user,
		}, room.ListUsers())

	case SignalAnswer, SignalOffer, SignalICECandidate:
		info, err := unmarshal[RTCMessageInfo](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}

		room, err := h.rooms.Get(info.RoomID)
		if err != nil {
			return
		}

		var recipient *User
		for _, u := range room.ListUsers() {
			if u.ID.String() == info.To {
				recipient = u
			}
		}
		if recipient == nil {
			h.log.Error(
				"failed to forward webrtc message",
				"error", fmt.Errorf("message recipient not found"),
			)
			return
		}

		recipient.send <- msg

	case SignalPing:
		return

	default:
		user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Invalid message type")
		return
	}
}

func broadcast(skip *User, msg Message, users []*User) {
	for _, u := range users {
		if u != skip {
			u.send <- msg
		}
	}
}

func broadcastNetworkUsers(to *User, users []*User) {
	if to != nil {
		var peers = []*User{}
		for _, user := range users {
			if user.ID != to.ID {
				peers = append(peers, user)
			}
		}
		to.send <- Message{
			Type: SignalNetworkUsers,
			Payload: map[string]any{
				"users": peers,
			},
		}
	}

	for _, recipient := range users {
		var peers = []*User{}
		for _, user := range users {
			if user.ID != recipient.ID {
				peers = append(peers, user)
			}
		}
		recipient.send <- Message{
			Type: SignalNetworkUsers,
			Payload: map[string]any{
				"users": peers,
			},
		}
	}
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
