package main

import (
	"errors"

	"github.com/gorilla/websocket"
)

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

func isUnexpectedCloseError(err error) bool {
	return websocket.IsUnexpectedCloseError(err,
		websocket.CloseGoingAway,
		websocket.CloseNoStatusReceived,
		websocket.CloseAbnormalClosure,
	)
}
