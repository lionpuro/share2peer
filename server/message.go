package main

import "errors"

var (
	ErrUnknownMessageType = errors.New("unknown message type")
)

const (
	MessageError    = "error"
	MessageIdentity = "identity"
	// Sessions
	MessageSessionInfo    = "session-info"
	MessageJoinSession    = "join-session"
	MessageRequestSession = "request-session"
	MessageSessionCreated = "session-created"
	MessageSessionJoined  = "session-joined"
)

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}
