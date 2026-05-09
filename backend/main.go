package main

import (
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
)

func main() {
	logger := NewLogger(getLogLevel())
	origins := os.Getenv("ALLOWED_ORIGINS")
	sh := NewSignalHandler(
		logger,
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
				logger.Error("failed to upgrade request", "error", err)
			}
			return
		}
		if err := sh.serve(conn, r); err != nil {
			if errors.Is(err, ErrUnknownMessageType) {
				return
			}
			logger.Error("error serving websocket", "error", err)
			return
		}
	})

	s := &http.Server{
		Addr:    fmt.Sprintf(":%s", os.Getenv("PORT")),
		Handler: mux,
	}

	logger.Info(fmt.Sprintf("Listening on %s...", s.Addr))
	log.Fatal(s.ListenAndServe())
}

func getLogLevel() slog.Level {
	val := os.Getenv("LOG_LEVEL")
	switch strings.ToLower(val) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
