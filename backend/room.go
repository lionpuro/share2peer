package main

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"sync"

	"github.com/google/uuid"
)

type Room struct {
	ID    string       `json:"id"`
	mu    sync.RWMutex `json:"-"`
	Host  uuid.UUID    `json:"host"`
	Users []*User      `json:"users"`
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

func (r *Room) ForEachUser(fn func(user *User)) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, user := range r.Users {
		fn(user)
	}
}

type RoomStore struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}

func NewRoomStore() *RoomStore {
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

func (s *RoomStore) Create(host uuid.UUID) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := generateRoomID()
	if err != nil {
		return nil, fmt.Errorf("generate room id: %s", err.Error())
	}
	if _, ok := s.rooms[id]; ok {
		return nil, fmt.Errorf("duplicate room id")
	}

	room := &Room{
		ID:   id,
		Host: host,
	}
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
