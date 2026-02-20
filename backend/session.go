package main

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"sync"

	"github.com/google/uuid"
)

type Session struct {
	ID      string       `json:"id"`
	mu      sync.RWMutex `json:"-"`
	Host    uuid.UUID    `json:"host"`
	Clients []*Client    `json:"clients"`
}

func (s *Session) AddClient(c *Client) error {
	s.mu.Lock()
	defer s.mu.Unlock()

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
		return nil, ErrSessionNotFound
	}
	return sess, nil
}

func (s *SessionStore) Create(host uuid.UUID) (*Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := generateSessionID()
	if err != nil {
		return nil, fmt.Errorf("generate session id: %s", err.Error())
	}
	session := &Session{
		ID:   id,
		Host: host,
	}
	s.sessions[id] = session
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
	idLength = 6
	idChars  = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ" // 1-9 and A-Z except for I and O
)

func generateSessionID() (string, error) {
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
