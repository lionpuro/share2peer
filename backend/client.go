package main

import (
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mileusna/useragent"
)

type Client struct {
	ID          uuid.UUID       `json:"id"`
	DisplayName string          `json:"display_name"`
	DeviceType  string          `json:"device_type"`
	DeviceName  string          `json:"device_name"`
	sessionID   string          `json:"-"`
	conn        *websocket.Conn `json:"-"`
	mu          sync.Mutex      `json:"-"`
}

func createClient(conn *websocket.Conn, deviceType string, deviceName string) *Client {
	return &Client{
		ID:          uuid.New(),
		DisplayName: generateName(),
		DeviceType:  deviceType,
		DeviceName:  deviceName,
		conn:        conn,
	}
}

func (c *Client) send(v any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

const (
	DeviceTypeDesktop = "desktop"
	DeviceTypeTablet  = "tablet"
	DeviceTypeMobile  = "mobile"
	DeviceTypeUnknown = "unknown"
)

func deviceInfo(ua useragent.UserAgent) (string, string) {
	t := DeviceTypeUnknown
	switch {
	case ua.Desktop:
		t = DeviceTypeDesktop
	case ua.Tablet:
		t = DeviceTypeTablet
	case ua.Mobile:
		t = DeviceTypeMobile
	}
	n := ua.OS
	specif := ua.Name
	if ua.Device != "" {
		specif = ua.Device
	}
	if specif != "" {
		n += " " + specif
	}
	return t, n
}
