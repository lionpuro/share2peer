package main

import (
	"errors"
	"fmt"
	"log/slog"
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
	h.users.add(u)
	u.send <- Message{
		Type:    signalIdentity,
		Payload: u,
	}
	broadcastNetworkUsers(h.users.findByNetwork(u.network))
	h.log.Debug("connect user", "user", u)
}

func (h *Hub) handleUnregister(u *User) {
	defer func() {
		h.users.delete(u.ID)
		users := h.users.findByNetwork(u.network)
		broadcastNetworkUsers(users)
		h.log.Debug("disconnect user", "user", u)
		close(u.send)
	}()

	if u.roomID == "" {
		return
	}

	room, err := h.rooms.removeUser(u.roomID, u)
	if err != nil {
		return
	}

	users := room.listUsers()
	broadcast(u, Message{
		Type:    signalUserLeft,
		Payload: u,
	}, users)
	broadcast(u, Message{
		Type:    signalRoomState,
		Payload: room,
	}, users)
}

func (h *Hub) handleMessage(user *User, msg Message) {
	switch msg.Type {
	case signalInviteToRoom:
		payload, err := unmarshal[InviteToRoomPayload](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}
		to, ok := h.users.findByID(payload.UserID)
		if !ok {
			return
		}
		if to.network != user.network {
			return
		}
		to.send <- Message{
			Type: signalRoomInvitation,
			Payload: map[string]any{
				"from":    user,
				"room_id": payload.RoomID,
			},
		}

	case signalCreateRoom:
		room, err := h.rooms.create()
		if err != nil {
			user.send <- Message{
				Transaction: msg.Transaction,
				Type:        signalError,
				Payload: ErrorPayload{
					Code:    ErrCodeServerError,
					Message: "Server error",
				},
			}
		}
		user.send <- Message{
			Transaction: msg.Transaction,
			Type:        signalRoomCreated,
			Payload:     room,
		}

	case signalJoinRoom:
		payload, err := unmarshal[RoomIDPayload](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}

		// leave previous room in case the client hasn't done it already
		if user.roomID != "" {
			if room, err := h.rooms.removeUser(user.roomID, user); err == nil {
				broadcast(user, Message{
					Type:    signalUserLeft,
					Payload: user,
				}, room.Users)
				broadcast(user, Message{
					Type:    signalRoomState,
					Payload: room,
				}, room.Users)
			}
		}

		room, err := h.rooms.addUser(payload.RoomID, user)
		if err != nil {
			if errors.Is(err, ErrRoomNotFound) {
				user.send <- Message{
					Transaction: msg.Transaction,
					Type:        signalError,
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
			Type:        signalRoomJoined,
			Payload:     room,
		}
		broadcast(user, Message{
			Type:    signalRoomState,
			Payload: room,
		}, room.Users)
		broadcast(user, Message{
			Type:    signalUserJoined,
			Payload: user,
		}, room.Users)

	case signalLeaveRoom:
		payload, err := unmarshal[RoomIDPayload](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}

		room, err := h.rooms.removeUser(payload.RoomID, user)
		if err != nil {
			if errors.Is(err, ErrRoomNotFound) {
				user.send <- Message{
					Transaction: msg.Transaction,
					Type:        signalError,
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
			Type:        signalRoomLeft,
			Payload:     room,
		}

		broadcast(user, Message{
			Type:    signalRoomState,
			Payload: room,
		}, room.listUsers())

		broadcast(user, Message{
			Type:    signalUserLeft,
			Payload: user,
		}, room.listUsers())

	case signalAnswer, signalOffer, signalICECandidate:
		info, err := unmarshal[RTCMessageInfo](msg.Payload)
		if err != nil {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}

		if user.ID.String() != info.From {
			user.send <- createErrorResponse(msg, ErrCodeBadRequest, "Bad request")
			return
		}

		room, err := h.rooms.get(info.RoomID)
		if err != nil {
			return
		}

		var recipient *User
		for _, u := range room.listUsers() {
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

func broadcastNetworkUsers(users []*User) {
	for _, to := range users {
		var peers = []*User{}
		for _, user := range users {
			if user.ID != to.ID {
				peers = append(peers, user)
			}
		}
		to.send <- Message{
			Type: signalNetworkUsers,
			Payload: map[string]any{
				"users": peers,
			},
		}
	}
}
