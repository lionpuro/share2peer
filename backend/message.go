package main

import "github.com/google/uuid"

const (
	signalError          = "error"
	signalRegister       = "register"
	signalIdentity       = "identity"
	signalSettings       = "settings"
	signalRoomState      = "room-state"
	signalJoinRoom       = "join-room"
	signalLeaveRoom      = "leave-room"
	signalCreateRoom     = "create-room"
	signalRoomCreated    = "room-created"
	signalRoomJoined     = "room-joined"
	signalRoomLeft       = "room-left"
	signalUserJoined     = "user-joined"
	signalUserLeft       = "user-left"
	signalOffer          = "offer"
	signalAnswer         = "answer"
	signalICECandidate   = "ice-candidate"
	signalNetworkUsers   = "network-users"
	signalInviteToRoom   = "invite-to-room"
	signalRoomInvitation = "room-invitation"
)

type Message struct {
	user        *User
	Transaction string `json:"transaction,omitempty"`
	Type        string `json:"type"`
	Payload     any    `json:"payload"`
}

type RegisterPayload struct {
	Username string `json:"username"`
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
		Type:        signalError,
		Payload: ErrorPayload{
			Code:    code,
			Message: message,
		},
	}
}
