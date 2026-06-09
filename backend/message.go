package main

import "github.com/google/uuid"

const (
	SignalPing           = "ping"
	SignalError          = "error"
	SignalIdentity       = "identity"
	SignalRoomState      = "room-state"
	SignalJoinRoom       = "join-room"
	SignalLeaveRoom      = "leave-room"
	SignalCreateRoom     = "create-room"
	SignalRoomCreated    = "room-created"
	SignalRoomJoined     = "room-joined"
	SignalRoomLeft       = "room-left"
	SignalUserJoined     = "user-joined"
	SignalUserLeft       = "user-left"
	SignalOffer          = "offer"
	SignalAnswer         = "answer"
	SignalICECandidate   = "ice-candidate"
	SignalNetworkUsers   = "network-users"
	SignalInviteToRoom   = "invite-to-room"
	SignalRoomInvitation = "room-invitation"
)

type Message struct {
	user        *User
	Transaction string `json:"transaction,omitempty"`
	Type        string `json:"type"`
	Payload     any    `json:"payload"`
}

type RoomIDPayload struct {
	RoomID string `json:"room_id"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type RTCMessageInfo struct {
	RoomID string `json:"room_id"`
	From   string `json:"from"`
	To     string `json:"to"`
}

type InviteToRoomPayload struct {
	UserID uuid.UUID `json:"user_id"`
	RoomID string    `json:"room_id"`
}

func createErrorResponse(req Message, code, message string) Message {
	return Message{
		Transaction: req.Transaction,
		Type:        SignalError,
		Payload: ErrorPayload{
			Code:    code,
			Message: message,
		},
	}
}
