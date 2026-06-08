package main

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"sync"
	"time"
)

type Room struct {
	ID    string  `json:"id"`
	Users []*User `json:"users"`
	mu    sync.RWMutex
}

func (s *Room) AddUser(u *User) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u.roomID = s.ID
	s.Users = append(s.Users, u)
}

func (r *Room) RemoveUser(u *User) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var users []*User
	for _, usr := range r.Users {
		if usr.ID != u.ID {
			users = append(users, usr)
		}
	}
	u.roomID = ""
	r.Users = users
}

func (r *Room) ListUsers() []*User {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Users
}

type RoomStore struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}

func newRoomStore() *RoomStore {
	return &RoomStore{
		rooms: make(map[string]*Room),
	}
}

func (s *RoomStore) Get(id string) (*Room, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	room, exists := s.rooms[id]
	if !exists {
		return nil, ErrRoomNotFound
	}
	return room, nil
}

func (s *RoomStore) Create() (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := generateRoomID()
	if err != nil {
		return nil, fmt.Errorf("generate room id: %s", err.Error())
	}
	if _, ok := s.rooms[id]; ok {
		return nil, fmt.Errorf("duplicate room id")
	}

	room := &Room{ID: id}
	s.rooms[id] = room
	return room, nil
}

func (s *RoomStore) Update(id string, room *Room) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, ok := s.rooms[id]
	if !ok {
		return nil, fmt.Errorf("no room found")
	}
	s.rooms[id] = room

	return room, nil
}

func (s *RoomStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.rooms, id)
}

type RoomService struct {
	store  *RoomStore
	timers map[string]*time.Timer
	mu     sync.Mutex
}

func newRoomService(store *RoomStore) *RoomService {
	return &RoomService{
		store:  store,
		timers: make(map[string]*time.Timer),
	}
}

func (s *RoomService) Get(id string) (*Room, error) {
	return s.store.Get(id)
}

func (s *RoomService) Create() (*Room, error) {
	room, err := s.store.Create()
	if err != nil {
		return nil, err
	}

	s.startDeleteTimer(room.ID)

	return room, err
}

func (s *RoomService) Delete(id string) {
	s.stopDeleteTimer(id)
	s.store.Delete(id)
}

func (s *RoomService) AddUser(roomID string, u *User) (*Room, error) {
	room, err := s.store.Get(roomID)
	if err != nil {
		return nil, err
	}

	room.AddUser(u)
	s.stopDeleteTimer(roomID)

	return room, nil
}

func (s *RoomService) RemoveUser(roomID string, u *User) (*Room, error) {
	room, err := s.store.Get(roomID)
	if err != nil {
		return nil, err
	}

	room.RemoveUser(u)
	if len(room.Users) == 0 {
		s.startDeleteTimer(roomID)
	}

	return room, nil
}

func (s *RoomService) startDeleteTimer(roomID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	timer := time.AfterFunc(60*time.Second, func() {
		defer s.stopDeleteTimer(roomID)
		room, err := s.store.Get(roomID)
		if err != nil {
			return
		}
		if len(room.Users) == 0 {
			s.Delete(room.ID)
		}
	})

	s.timers[roomID] = timer
}

func (s *RoomService) stopDeleteTimer(roomID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	timer, ok := s.timers[roomID]
	if ok {
		timer.Stop()
		delete(s.timers, roomID)
	}
}

const (
	idLength = 6
	idChars  = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ" // 1-9 and A-Z except for I and O
)

func generateRoomID() (string, error) {
	bytes := make([]byte, idLength)
	for i := range idLength {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(idChars))))
		if err != nil {
			return "", err
		}
		bytes[i] = idChars[num.Int64()]
	}

	return string(bytes), nil
}
