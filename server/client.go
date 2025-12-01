package main

import (
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Client struct {
	ID        uuid.UUID       `json:"id"`
	conn      *websocket.Conn `json:"-"`
	sessionID string          `json:"-"`
}

func createClient(conn *websocket.Conn) *Client {
	return &Client{
		ID:   uuid.New(),
		conn: conn,
	}
}
