package types

import (
	"time"
)

// Vector3 represents a 3D vector
type Vector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Player represents a player in the game
type Player struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"displayName"`
	Position    Vector3 `json:"position"`
	Rotation    Vector3 `json:"rotation"`
	Health      int     `json:"health"`
	IsAlive     bool    `json:"isAlive"`
	Kills       int     `json:"kills"`
	Deaths      int     `json:"deaths"`
}

// GameState represents the current state of the game
type GameState struct {
	Players      map[string]*Player `json:"players"`
	GameTime     float64            `json:"gameTime"`
	IsGameActive bool               `json:"isGameActive"`
	MatchID      string             `json:"matchId"`
}

// MessageType represents the type of message being sent
type MessageType string

const (
	MessageTypeConnect      MessageType = "connect"
	MessageTypeDisconnect   MessageType = "disconnect"
	MessageTypePlayerUpdate MessageType = "playerUpdate"
	MessageTypeGameState    MessageType = "gameState"
	MessageTypePlayerAction MessageType = "playerAction"
	MessageTypeSetName      MessageType = "setName"
	MessageTypeError        MessageType = "error"
	MessageTypePlayerID     MessageType = "playerId"
)

// PlayerAction represents a player's action in the game
type PlayerAction struct {
	Type string `json:"type"`
	Data struct {
		Position  *Vector3 `json:"position,omitempty"`
		Rotation  *Vector3 `json:"rotation,omitempty"`
		Target    *Vector3 `json:"target,omitempty"`
		Direction *Vector3 `json:"direction,omitempty"`
		WeaponID  string   `json:"weaponId,omitempty"`
	} `json:"data"`
}

// GameMessage represents a message sent between client and server
type GameMessage struct {
	Type      MessageType `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
}

// ErrorMessage represents an error message
type ErrorMessage struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// SetNamePayload represents a player setting their display name
type SetNamePayload struct {
	DisplayName string `json:"displayName"`
}

// ValidateMessage validates a game message
func ValidateMessage(msg *GameMessage) error {
	if msg.Type == "" {
		return ErrInvalidMessageType
	}

	if msg.Timestamp.IsZero() {
		return ErrInvalidTimestamp
	}

	switch msg.Type {
	case MessageTypePlayerAction:
		action, ok := msg.Payload.(PlayerAction)
		if !ok {
			return ErrInvalidPayload
		}
		if err := validatePlayerAction(&action); err != nil {
			return err
		}
	}

	return nil
}

// validatePlayerAction validates a player action
func validatePlayerAction(action *PlayerAction) error {
	if action.Type == "" {
		return ErrInvalidActionType
	}

	switch action.Type {
	case "move", "jump", "shoot", "reload":
		// Valid action types
	default:
		return ErrInvalidActionType
	}

	return nil
}
