package main

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mileusna/useragent"
)

const (
	writeDeadline = 10 * time.Second

	pongWait = 60 * time.Second
	pingWait = (pongWait * 9) / 10
)

type User struct {
	ID         uuid.UUID `json:"id"`
	Username   string    `json:"username"`
	DeviceType string    `json:"device_type"`
	DeviceName string    `json:"device_name"`
	settings   Settings
	network    string
	roomID     string
	conn       *websocket.Conn
	hub        *Hub
	// send is a buffered channel for outbound messages
	send chan Message
}

func createUser(hub *Hub, conn *websocket.Conn, username string, info clientInfo) *User {
	return &User{
		ID:         uuid.New(),
		Username:   username,
		DeviceType: info.deviceType,
		DeviceName: info.deviceName,
		settings:   Settings{Discoverable: false},
		network:    info.network,
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

	if err := u.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		hub.log.Error("failed to set read deadline", "error", err)
	}
	u.conn.SetPongHandler(func(string) error {
		if err := u.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
			hub.log.Error("failed to set read deadline", "error", err)
		}
		return nil
	})

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
	ticker := time.NewTicker(pingWait)

	defer func() {
		ticker.Stop()
		if err := u.conn.Close(); err != nil {
			if !errors.Is(err, net.ErrClosed) {
				hub.log.Error("error closing connection", "error", err)
			}
		}
	}()

	for {
		select {
		case msg, ok := <-u.send:
			if !ok {
				return
			}
			if err := u.conn.SetWriteDeadline(time.Now().Add(writeDeadline)); err != nil {
				hub.log.Error("failed to set write deadline", "error", err)
			}
			if err := u.conn.WriteJSON(msg); err != nil {
				return
			}
		case <-ticker.C:
			if err := u.conn.SetWriteDeadline(time.Now().Add(writeDeadline)); err != nil {
				hub.log.Error("failed to set write deadline", "error", err)
			}
			if err := u.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
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
	if user.network != "" {
		if _, ok := s.usersByNetwork[user.network]; !ok {
			s.usersByNetwork[user.network] = make(map[uuid.UUID]*User)
		}
		s.usersByNetwork[user.network][user.ID] = user
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
	if user.network != "" {
		delete(s.usersByNetwork[user.network], user.ID)
		if len(s.usersByNetwork[user.network]) == 0 {
			delete(s.usersByNetwork, user.network)
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
	deviceTypeDesktop = "desktop"
	deviceTypeTablet  = "tablet"
	deviceTypeMobile  = "mobile"
	deviceTypeUnknown = "unknown"
)

func extractDeviceInfo(userag string) (string, string) {
	ua := useragent.Parse(userag)

	t := deviceTypeUnknown
	switch {
	case ua.Desktop:
		t = deviceTypeDesktop
	case ua.Tablet:
		t = deviceTypeTablet
	case ua.Mobile:
		t = deviceTypeMobile
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
	network    string
	deviceType string
	deviceName string
}

func extractClientInfo(req *http.Request) clientInfo {
	var network string
	if addr, ok := parseIP(req.Header.Get("X-Forwarded-For")); ok {
		network = getNetworkIdentifier(addr)
	}

	dt, dn := extractDeviceInfo(req.Header.Get("User-Agent"))

	return clientInfo{
		network:    network,
		deviceType: dt,
		deviceName: dn,
	}
}

type Settings struct {
	Discoverable bool `json:"discoverable"`
}
