package main

import (
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mileusna/useragent"
)

type User struct {
	ID          uuid.UUID       `json:"id"`
	DisplayName string          `json:"display_name"`
	DeviceType  string          `json:"device_type"`
	DeviceName  string          `json:"device_name"`
	roomID      string          `json:"-"`
	conn        *websocket.Conn `json:"-"`
	mu          sync.Mutex      `json:"-"`
}

func createUser(conn *websocket.Conn, deviceType string, deviceName string) *User {
	return &User{
		ID:          uuid.New(),
		DisplayName: generateName(),
		DeviceType:  deviceType,
		DeviceName:  deviceName,
		conn:        conn,
	}
}

func (u *User) send(v any) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.conn.WriteJSON(v)
}

const (
	DeviceTypeDesktop = "desktop"
	DeviceTypeTablet  = "tablet"
	DeviceTypeMobile  = "mobile"
	DeviceTypeUnknown = "unknown"
)

type clientInfo struct {
	deviceType string
	deviceName string
}

func extractClientInfo(userag string) clientInfo {
	ua := useragent.Parse(userag)

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

	return clientInfo{deviceType: t, deviceName: n}
}
