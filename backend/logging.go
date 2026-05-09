package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"runtime"
	"sync"
	"time"
)

func NewLogger(level slog.Level) *slog.Logger {
	return slog.New(NewLogHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: false,
		Level:     level,
	}))
}

type LogHandler struct {
	opts slog.HandlerOptions
	h    slog.Handler
	mu   *sync.Mutex
	out  io.Writer
}

func NewLogHandler(w io.Writer, opts *slog.HandlerOptions) *LogHandler {
	if opts == nil {
		opts = &slog.HandlerOptions{}
	}
	h := &LogHandler{
		opts: *opts,
		h: slog.NewTextHandler(w, &slog.HandlerOptions{
			Level:       opts.Level,
			AddSource:   opts.AddSource,
			ReplaceAttr: nil,
		}),
		out: w,
		mu:  &sync.Mutex{},
	}
	return h
}

func (h *LogHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.h.Enabled(ctx, level)
}

func (h *LogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &LogHandler{h: h.h.WithAttrs(attrs), out: h.out, mu: h.mu}
}

func (h *LogHandler) WithGroup(name string) slog.Handler {
	return &LogHandler{h: h.h.WithGroup(name), out: h.out, mu: h.mu}
}

func (h *LogHandler) Handle(ctx context.Context, r slog.Record) error {
	var buf []byte

	if !r.Time.IsZero() {
		buf = r.Time.AppendFormat(buf, time.RFC3339)
		buf = append(buf, ' ')
	}
	buf = append(buf, r.Level.String()...)
	buf = append(buf, ' ')
	buf = append(buf, r.Message...)
	if h.opts.AddSource && r.PC != 0 {
		fs := runtime.CallersFrames([]uintptr{r.PC})
		f, _ := fs.Next()
		buf = h.appendAttr(buf, slog.String(slog.SourceKey, fmt.Sprintf("%s:%d", f.File, f.Line)))
	}
	r.Attrs(func(a slog.Attr) bool {
		buf = h.appendAttr(buf, a)
		return true
	})
	buf = append(buf, '\n')

	h.mu.Lock()
	defer h.mu.Unlock()

	_, err := h.out.Write(buf)
	return err
}

func (h *LogHandler) appendAttr(buf []byte, a slog.Attr) []byte {
	if a.Equal(slog.Attr{}) {
		return buf
	}
	if a.Value.Kind() != slog.KindGroup {
		buf = append(buf, ' ')
		buf = append(buf, a.Key...)
		buf = append(buf, '=')
		return fmt.Appendf(buf, "\"%+v\"", a.Value.Any())
	}
	for _, a := range a.Value.Group() {
		buf = h.appendAttr(buf, a)
	}
	return buf
}
