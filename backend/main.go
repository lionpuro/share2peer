package main

import (
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
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

func getenv(key string, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
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
