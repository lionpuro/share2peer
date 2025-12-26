package main

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"sync"
)

var (
	ErrSessionFull      = errors.New("session is full")
	ErrSessionNotExists = errors.New("session does not exist")
)

type Session struct {
	ID      string       `json:"id"`
	mu      sync.RWMutex `json:"-"`
	Clients []*Client    `json:"clients"`
}

func (s *Session) AddClient(c *Client) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.Clients) >= 2 {
		return ErrSessionFull
	}
	c.sessionID = s.ID
	s.Clients = append(s.Clients, c)
	return nil
}

func (s *Session) RemoveClient(c *Client) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var clients []*Client
	for _, cl := range s.Clients {
		if cl.ID != c.ID {
			clients = append(clients, cl)
		}
	}
	c.sessionID = ""
	s.Clients = clients
}

func (s *Session) ForEachClient(fn func(client *Client)) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, client := range s.Clients {
		fn(client)
	}
}

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]*Session),
	}
}

func (s *SessionStore) Get(id string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sess, exists := s.sessions[id]
	if !exists {
		return nil, ErrSessionNotExists
	}
	return sess, nil
}

func (s *SessionStore) Create() (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	code, err := generateSessionID()
	if err != nil {
		return nil, fmt.Errorf("generate share code: %s", err.Error())
	}
	session := &Session{
		ID: code,
	}
	s.sessions[code] = session
	return session, nil
}

func (s *SessionStore) Update(id string, session *Session) (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, ok := s.sessions[id]
	if !ok {
		return nil, fmt.Errorf("no session found")
	}
	s.sessions[id] = session

	return session, nil
}

func (s *SessionStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.sessions, id)
}

const (
	shareCodeLength = 6
	shareCodeChars  = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ" // 0-9 and A-Z except for I and O
)

func generateSessionID() (string, error) {
	length := shareCodeLength
	bytes := make([]byte, length)
	for i := range length {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(shareCodeChars))))
		if err != nil {
			return "", err
		}
		bytes[i] = shareCodeChars[num.Int64()]
	}

	return string(bytes), nil
}
