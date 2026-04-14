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
	origins := os.Getenv("ALLOWED_ORIGINS")
	sh := NewSignalHandler(
		origins,
		NewUserService(),
		NewRoomService(NewRoomStore()),
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/socket", func(w http.ResponseWriter, r *http.Request) {
		(w).Header().Set("Access-Control-Allow-Origin", "*")
		conn, err := sh.upgrader.Upgrade(w, r, nil)
		if err != nil {
			if strings.Contains(err.Error(), "websocket: request origin not allowed by Upgrader.CheckOrigin") {
				return
			}
			if !strings.Contains(err.Error(), "the client is not using the websocket protocol") {
				log.Printf("upgrade request: %v", err)
			}
			return
		}
		if err := sh.serve(conn, r.Header); err != nil {
			if errors.Is(err, ErrUnknownMessageType) {
				return
			}
			log.Printf("websocket handler: %s", err.Error())
			return
		}
	})

	s := &http.Server{
		Addr:    fmt.Sprintf(":%s", os.Getenv("PORT")),
		Handler: mux,
	}

	fmt.Printf("Listening on %s...\n", s.Addr)
	log.Fatal(s.ListenAndServe())
}
