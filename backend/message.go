package main

const (
	SignalError          = "error"
	SignalIdentity       = "identity"
	SignalSessionClosed  = "session-closed"
	SignalSessionInfo    = "session-info"
	SignalJoinSession    = "join-session"
	SignalLeaveSession   = "leave-session"
	SignalRequestSession = "request-session"
	SignalSessionCreated = "session-created"
	SignalSessionJoined  = "session-joined"
	SignalSessionLeft    = "session-left"
	SignalClientJoined   = "client-joined"
	SignalClientLeft     = "client-left"
	SignalOffer          = "offer"
	SignalAnswer         = "answer"
	SignalICECandidate   = "ice-candidate"
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

type SessionIDPayload struct {
	SessionID string `json:"session_id"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type RTCMessageInfo struct {
	SessionID string `json:"session_id"`
	From      string `json:"from"`
	To        string `json:"to"`
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
