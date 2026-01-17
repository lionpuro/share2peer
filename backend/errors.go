package main

import "errors"

var (
	ErrUnknownMessageType = errors.New("unknown message type")
	ErrServerError        = errors.New("internal server error")
	ErrSessionNotFound    = errors.New("session not found")
)

const (
	ErrCodeServerError = "SERVER_ERROR"
)
