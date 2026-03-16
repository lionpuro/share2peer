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
	networkKey  string          `json:"-"`
	roomID      string          `json:"-"`
	conn        *websocket.Conn `json:"-"`
	mu          sync.Mutex      `json:"-"`
}

func createUser(conn *websocket.Conn, ip, deviceType, deviceName string) *User {
	return &User{
		ID:          uuid.New(),
		DisplayName: generateName(),
		DeviceType:  deviceType,
		DeviceName:  deviceName,
		networkKey:  getNetworkKey(ip),
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
