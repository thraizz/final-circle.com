package types

import "errors"

var (
	ErrInvalidMessageType  = errors.New("invalid message type")
	ErrInvalidTimestamp    = errors.New("invalid timestamp")
	ErrInvalidPayload      = errors.New("invalid payload")
	ErrInvalidActionType   = errors.New("invalid action type")
	ErrInvalidPlayerID     = errors.New("invalid player ID")
	ErrInvalidPosition     = errors.New("invalid position")
	ErrInvalidRotation     = errors.New("invalid rotation")
	ErrGameNotActive       = errors.New("game is not active")
	ErrPlayerNotFound      = errors.New("player not found")
	ErrPlayerAlreadyExists = errors.New("player already exists")
)
