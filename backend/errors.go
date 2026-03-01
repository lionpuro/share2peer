package main

import "errors"

var (
	ErrUnknownMessageType = errors.New("unknown message type")
	ErrServerError        = errors.New("internal server error")
	ErrRoomNotFound       = errors.New("room not found")
)

const (
	ErrCodeServerError = "SERVER_ERROR"
	ErrCodeNotFound    = "NOT_FOUND"
	ErrCodeBadRequest  = "BAD_REQUEST"
)
