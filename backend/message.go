package main

const (
	MessageError           = "error"
	MessageIdentity        = "identity"
	MessageSessionNotFound = "session-not-found"
	MessageSessionInfo     = "session-info"
	MessageJoinSession     = "join-session"
	MessageLeaveSession    = "leave-session"
	MessageRequestSession  = "request-session"
	MessageSessionCreated  = "session-created"
	MessageSessionJoined   = "session-joined"
	MessageSessionLeft     = "session-left"
	MessageClientJoined    = "client-joined"
	MessageClientLeft      = "client-left"
	MessageOffer           = "offer"
	MessageAnswer          = "answer"
	MessageICECandidate    = "ice-candidate"
)

type Message struct {
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
