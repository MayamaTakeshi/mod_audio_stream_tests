package main

import (
	"ivr_server/eventsocket"
	"sync"
)

// ConnectionMap is a thread-safe map to store connections.
type ConnectionMap struct {
	sync.RWMutex
	connections map[string]*eventsocket.Connection
}

// NewConnectionMap creates a new instance of ConnectionMap.
func NewConnectionMap() *ConnectionMap {
	return &ConnectionMap{
		connections: make(map[string]*eventsocket.Connection),
	}
}

// Add adds a connection to the map.
func (cm *ConnectionMap) Add(key string, conn *eventsocket.Connection) {
	cm.Lock()
	defer cm.Unlock()
	cm.connections[key] = conn
}

// Get retrieves a connection from the map by key.
func (cm *ConnectionMap) Get(key string) (*eventsocket.Connection, bool) {
	cm.RLock()
	defer cm.RUnlock()
	conn, ok := cm.connections[key]
	return conn, ok
}

// Remove removes a connection from the map by key.
func (cm *ConnectionMap) Remove(key string) {
	cm.Lock()
	defer cm.Unlock()
	delete(cm.connections, key)
}
