package main

import (
	"encoding/base64"
	"net/http"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mileusna/useragent"
)

type User struct {
	ID         uuid.UUID       `json:"id"`
	Username   string          `json:"username"`
	DeviceType string          `json:"device_type"`
	DeviceName string          `json:"device_name"`
	networkKey string          `json:"-"`
	roomID     string          `json:"-"`
	conn       *websocket.Conn `json:"-"`
	mu         sync.Mutex      `json:"-"`
}

func createUser(conn *websocket.Conn, info clientInfo) *User {
	return &User{
		ID:         uuid.New(),
		Username:   info.username,
		DeviceType: info.deviceType,
		DeviceName: info.deviceName,
		networkKey: getNetworkKey(info.ip),
		conn:       conn,
	}
}

func (u *User) send(v any) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.conn.WriteJSON(v)
}

type UserService struct {
	usersByID      map[uuid.UUID]*User
	usersByNetwork map[string]map[uuid.UUID]*User
	mu             sync.RWMutex
}

func NewUserService() *UserService {
	return &UserService{
		usersByID:      make(map[uuid.UUID]*User),
		usersByNetwork: make(map[string]map[uuid.UUID]*User),
	}
}

func (s *UserService) Register(user *User) {
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

func (s *UserService) Delete(id uuid.UUID) {
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

func (s *UserService) FindByID(id uuid.UUID) (*User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.usersByID[id]
	return user, ok
}

func (s *UserService) FindByNetwork(key string) []*User {
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
	ip := extractIP(req.Header)
	dt, dn := extractDeviceInfo(req.Header.Get("User-Agent"))
	name := req.URL.Query().Get("n")
	if name != "" {
		decoded, err := base64.RawURLEncoding.DecodeString(name)
		if err != nil {
			name = ""
		} else {
			name = string(decoded)
		}
	}
	if name == "" {
		name = generateUsername()
	}

	return clientInfo{
		ip:         ip,
		username:   name,
		deviceType: dt,
		deviceName: dn,
	}
}
