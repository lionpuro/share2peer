package main

import (
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

func handler(hub *Hub, origins string) http.HandlerFunc {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			if origins == "*" {
				return true
			}
			origin := r.Header.Get("Origin")
			for o := range strings.SplitSeq(origins, ",") {
				if origin == o {
					return true
				}
			}
			return false
		},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		(w).Header().Set("Access-Control-Allow-Origin", "*")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			if strings.Contains(err.Error(), "websocket: request origin not allowed by Upgrader.CheckOrigin") {
				return
			}
			if !strings.Contains(err.Error(), "the client is not using the websocket protocol") {
				hub.log.Error("failed to upgrade request", "error", err)
			}
			return
		}

		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			hub.log.Debug("error reading initial message", "error", err)
			return
		}
		if msg.Type != SignalRegister {
			return
		}
		payload, err := unmarshal[RegisterPayload](msg.Payload)
		if err != nil {
			hub.log.Debug("failed to unmarshal register message", "error", err)
			return
		}
		if payload.Username == "" {
			payload.Username = generateUsername()
		}

		user := createUser(hub, conn, payload.Username, extractClientInfo(r))
		hub.register <- user

		go user.writePump()
		go user.readPump()
	}
}
