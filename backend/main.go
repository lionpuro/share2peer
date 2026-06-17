package main

import (
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"strings"
)

func main() {
	logger := newLogger(
		getLogLevel(),
		strings.ToLower(getenv("LOG_FORMAT", "text")),
	)

	hub := newHub(
		logger,
		newUserService(),
		newRoomService(newRoomStore()),
	)
	go hub.run()

	handle := handler(hub, getenv("ALLOWED_ORIGINS", ""))

	mux := http.NewServeMux()
	mux.HandleFunc("/socket", handle)

	s := &http.Server{
		Addr:    fmt.Sprintf(":%s", getenv("PORT", "3000")),
		Handler: mux,
	}

	logger.Info(fmt.Sprintf("Listening on %s...", s.Addr))
	log.Fatal(s.ListenAndServe())
}

func getLogLevel() slog.Level {
	val := getenv("LOG_LEVEL", "info")
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
