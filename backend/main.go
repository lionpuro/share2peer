package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

func main() {
	wh := &WebSocketHandler{
		sessions: NewSessionStore(),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		(w).Header().Set("Access-Control-Allow-Origin", "*")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			if !strings.Contains(err.Error(), "the client is not using the websocket protocol") {
				log.Printf("upgrade request: %v", err)
			}
			return
		}
		if err := wh.handleWebSocket(conn, r.Header); err != nil {
			if !errors.Is(err, ErrUnknownMessageType) {
				log.Printf("websocket handler: %s", err.Error())
			}
			return
		}
	})

	s := &http.Server{
		Addr:    fmt.Sprintf(":%s", os.Getenv("SERVER_PORT")),
		Handler: mux,
	}

	fmt.Printf("Listening on %s...\n", s.Addr)
	log.Fatal(s.ListenAndServe())
}
