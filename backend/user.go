package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mileusna/useragent"
)

type User struct {
	ID         uuid.UUID `json:"id"`
	Username   string    `json:"username"`
	DeviceType string    `json:"device_type"`
	DeviceName string    `json:"device_name"`
	networkKey string
	roomID     string
	conn       *websocket.Conn
	hub        *Hub
	// send is a buffered channel for outbound messages
	send chan Message
}

func createUser(hub *Hub, conn *websocket.Conn, info clientInfo) *User {
	return &User{
		ID:         uuid.New(),
		Username:   info.username,
		DeviceType: info.deviceType,
		DeviceName: info.deviceName,
		networkKey: getNetworkKey(info.ip),
		conn:       conn,
		send:       make(chan Message, 256),
		hub:        hub,
	}
}

// readPump pumps messages from the connection to the hub.
//
// The application runs readPump in a per-connection goroutine and ensures
// ensures that there is at most one reader on a connection by executing all
// reads from this goroutine.
func (u *User) readPump() {
	hub := u.hub
	defer func() {
		hub.unregister <- u
		if err := u.conn.Close(); err != nil {
			if !errors.Is(err, net.ErrClosed) {
				hub.log.Error("error closing connection", "error", err)
			}
		}
	}()

	for {
		_, msg, err := u.conn.ReadMessage()
		if err != nil {
			if isUnexpectedCloseError(err) {
				hub.log.Error("unexpected close error", "error", err)
			}
			return
		}

		var message Message
		if err := json.Unmarshal(msg, &message); err != nil {
			hub.log.Error("failed to parse message", "error", err)
			continue
		}

		message.user = u
		hub.send <- message
	}
}

// writePump pumps messages from the hub to the connection.
//
// A goroutine running writePump is started for each connection.
// The application ensures that there is at most one writer to a connection by
// executing all writes from this goroutine.
func (u *User) writePump() {
	hub := u.hub
	defer func() {
		if err := u.conn.Close(); err != nil {
			if !errors.Is(err, net.ErrClosed) {
				hub.log.Error("error closing connection", "error", err)
			}
		}
	}()

	for msg := range u.send {
		if err := u.conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
			hub.log.Error("write deadline exceeded", "error", err)
		}
		if err := u.conn.WriteJSON(msg); err != nil {
			return
		}
	}
}

type UserService struct {
	usersByID      map[uuid.UUID]*User
	usersByNetwork map[string]map[uuid.UUID]*User
	mu             sync.RWMutex
}

func newUserService() *UserService {
	return &UserService{
		usersByID:      make(map[uuid.UUID]*User),
		usersByNetwork: make(map[string]map[uuid.UUID]*User),
	}
}

func (s *UserService) add(user *User) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.usersByID[user.ID] = user
	if user.networkKey != "" {
		if _, ok := s.usersByNetwork[user.networkKey]; !ok {
			s.usersByNetwork[user.networkKey] = make(map[uuid.UUID]*User)
		}
		s.usersByNetwork[user.networkKey][user.ID] = user
	}
}

func (s *UserService) delete(id uuid.UUID) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.usersByID[id]
	if !ok {
		return
	}
	delete(s.usersByID, id)
	if user.networkKey != "" {
		delete(s.usersByNetwork[user.networkKey], user.ID)
		if len(s.usersByNetwork[user.networkKey]) == 0 {
			delete(s.usersByNetwork, user.networkKey)
		}
	}
}

func (s *UserService) findByID(id uuid.UUID) (*User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.usersByID[id]
	return user, ok
}

func (s *UserService) findByNetwork(key string) []*User {
	s.mu.Lock()
	defer s.mu.Unlock()

	usermap, ok := s.usersByNetwork[key]
	if !ok {
		return nil
	}
	var users []*User
	for _, u := range usermap {
		users = append(users, u)
	}
	return users
}

const (
	DeviceTypeDesktop = "desktop"
	DeviceTypeTablet  = "tablet"
	DeviceTypeMobile  = "mobile"
	DeviceTypeUnknown = "unknown"
)

func extractDeviceInfo(userag string) (string, string) {
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

	return t, n
}

type clientInfo struct {
	ip         string
	username   string
	deviceType string
	deviceName string
}

func extractClientInfo(req *http.Request) clientInfo {
	var ip string
	if addr, ok := parseIP(req.Header.Get("X-Forwarded-For")); ok {
		ip = addr.String()
	}

	dt, dn := extractDeviceInfo(req.Header.Get("User-Agent"))

	sess, err := parseSessionData(req.URL.Query().Get("s"))
	if err != nil {
		sess = sessionData{Username: generateUsername()}
	}

	return clientInfo{
		ip:         ip,
		username:   sess.Username,
		deviceType: dt,
		deviceName: dn,
	}
}

type sessionData struct {
	Username string `json:"username"`
}

func parseSessionData(input string) (sessionData, error) {
	if input == "" {
		return sessionData{}, fmt.Errorf("input is empty")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(input)
	if err != nil {
		return sessionData{}, err
	}
	var data sessionData
	if err := json.Unmarshal(decoded, &data); err != nil {
		return data, err
	}
	return data, nil
}
