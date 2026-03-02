package main

const (
	SignalError        = "error"
	SignalIdentity     = "identity"
	SignalRoomClosed   = "room-closed"
	SignalRoomInfo     = "room-info"
	SignalJoinRoom     = "join-room"
	SignalLeaveRoom    = "leave-room"
	SignalCreateRoom   = "create-room"
	SignalRoomCreated  = "room-created"
	SignalRoomJoined   = "room-joined"
	SignalRoomLeft     = "room-left"
	SignalUserJoined   = "user-joined"
	SignalUserLeft     = "user-left"
	SignalOffer        = "offer"
	SignalAnswer       = "answer"
	SignalICECandidate = "ice-candidate"
)

type Message struct {
	Transaction string      `json:"transaction,omitempty"`
	Type        string      `json:"type"`
	Body        MessageBody `json:"body"`
}

type MessageBody struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
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

func createErrorResponse(req Message, code, message string) Message {
	return Message{
		Transaction: req.Transaction,
		Type:        "response",
		Body: MessageBody{
			Type: SignalError,
			Payload: ErrorPayload{
				Code:    code,
				Message: message,
			},
		},
	}
}
