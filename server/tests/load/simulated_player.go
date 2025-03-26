package load

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// SimulatedPlayer represents a fake player that connects to the game server
// and performs actions to simulate real player behavior
type SimulatedPlayer struct {
	ID           string
	Conn         *websocket.Conn
	ServerURL    string
	Position     [3]float64
	IsConnected  bool
	StopChan     chan struct{}
	ActionRate   float64
	MovementProb float64
	ShootingProb float64
	Stats        *TestStats
}

// NewSimulatedPlayer creates a new simulated player
func NewSimulatedPlayer(id string, serverURL string, actionRate, movementProb, shootingProb float64, stats *TestStats) *SimulatedPlayer {
	return &SimulatedPlayer{
		ID:           id,
		ServerURL:    serverURL,
		Position:     [3]float64{0, 0, 0},
		IsConnected:  false,
		StopChan:     make(chan struct{}),
		ActionRate:   actionRate,
		MovementProb: movementProb,
		ShootingProb: shootingProb,
		Stats:        stats,
	}
}

// Connect establishes a WebSocket connection to the game server
func (p *SimulatedPlayer) Connect() error {
	startTime := time.Now()

	// Connect to WebSocket server
	conn, _, err := websocket.DefaultDialer.Dial(p.ServerURL, nil)
	if err != nil {
		p.Stats.Lock()
		p.Stats.FailedConnections++
		p.Stats.Unlock()
		return fmt.Errorf("dial error: %v", err)
	}

	p.Conn = conn
	p.IsConnected = true

	// Increment connection counter
	p.Stats.Lock()
	p.Stats.TotalConnections++
	p.Stats.ConnectionTimes = append(p.Stats.ConnectionTimes, time.Since(startTime))
	p.Stats.PlayerCount++
	if p.Stats.PlayerCount > p.Stats.MaxConcurrentPlayers {
		p.Stats.MaxConcurrentPlayers = p.Stats.PlayerCount
	}
	p.Stats.Unlock()

	// Send join message
	joinMsg := map[string]interface{}{
		"type": "join",
		"data": map[string]interface{}{
			"id":   p.ID,
			"name": fmt.Sprintf("Bot_%s", p.ID),
		},
	}

	err = p.Conn.WriteJSON(joinMsg)
	if err != nil {
		return fmt.Errorf("error sending join message: %v", err)
	}

	return nil
}

// Disconnect closes the WebSocket connection
func (p *SimulatedPlayer) Disconnect() error {
	if !p.IsConnected || p.Conn == nil {
		return nil
	}

	// Send leave message
	leaveMsg := map[string]interface{}{
		"type": "leave",
		"data": map[string]interface{}{
			"id": p.ID,
		},
	}

	err := p.Conn.WriteJSON(leaveMsg)
	if err != nil {
		log.Printf("Error sending leave message: %v", err)
	}

	// Close connection
	err = p.Conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	if err != nil {
		log.Printf("Error sending close message: %v", err)
	}

	p.Conn.Close()
	p.IsConnected = false

	// Update stats
	p.Stats.Lock()
	p.Stats.PlayerCount--
	p.Stats.Unlock()

	return nil
}

// readMessages reads messages from the server
func (p *SimulatedPlayer) readMessages() {
	for {
		select {
		case <-p.StopChan:
			return
		default:
			if !p.IsConnected || p.Conn == nil {
				time.Sleep(100 * time.Millisecond)
				continue
			}

			// Read message
			start := time.Now()
			_, _, err := p.Conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Error reading message: %v", err)
				}
				p.IsConnected = false
				p.attemptReconnect()
				continue
			}

			// Record round trip time
			p.Stats.Lock()
			p.Stats.TotalMessages++
			p.Stats.RoundTripTimes = append(p.Stats.RoundTripTimes, time.Since(start))
			p.Stats.Unlock()

			// We could parse and react to the message here, but for load testing
			// we'll just simulate actions based on probabilities
		}
	}
}

// attemptReconnect tries to reconnect to the server
func (p *SimulatedPlayer) attemptReconnect() {
	p.Stats.Lock()
	p.Stats.TotalReconnects++
	p.Stats.Unlock()

	// Wait a random time before reconnecting (between 1-5 seconds)
	time.Sleep(time.Duration(1000+rand.Intn(4000)) * time.Millisecond)

	maxRetries := 3
	for retry := 0; retry < maxRetries; retry++ {
		err := p.Connect()
		if err == nil {
			return
		}

		log.Printf("Reconnect attempt %d failed: %v", retry+1, err)
		time.Sleep(time.Duration(500*(retry+1)) * time.Millisecond)
	}

	log.Printf("Failed to reconnect player %s after %d attempts", p.ID, maxRetries)
}

// SendMovement sends a simulated movement action
func (p *SimulatedPlayer) SendMovement() error {
	if !p.IsConnected || p.Conn == nil {
		return fmt.Errorf("not connected")
	}

	// Calculate random direction vector
	dx := rand.Float64()*2 - 1
	dz := rand.Float64()*2 - 1

	// Normalize
	mag := (dx*dx + dz*dz)
	if mag > 0 {
		mag = 1.0 / mag
		dx *= mag
		dz *= mag
	}

	// Update position
	p.Position[0] += dx * 0.5
	p.Position[2] += dz * 0.5

	// Ensure position remains within game boundaries
	const BOUND = 100.0
	if p.Position[0] > BOUND {
		p.Position[0] = BOUND
	}
	if p.Position[0] < -BOUND {
		p.Position[0] = -BOUND
	}
	if p.Position[2] > BOUND {
		p.Position[2] = BOUND
	}
	if p.Position[2] < -BOUND {
		p.Position[2] = -BOUND
	}

	// Create movement message
	moveMsg := map[string]interface{}{
		"type": "action",
		"data": map[string]interface{}{
			"type": "move",
			"direction": map[string]float64{
				"x": dx,
				"y": 0,
				"z": dz,
			},
		},
	}

	// Send message
	err := p.Conn.WriteJSON(moveMsg)
	if err != nil {
		p.Stats.Lock()
		p.Stats.FailedMessages++
		p.Stats.Unlock()
		return fmt.Errorf("error sending movement: %v", err)
	}

	// Record message time
	p.Stats.Lock()
	p.Stats.TotalMessages++
	p.Stats.Unlock()

	return nil
}

// SendShot sends a simulated shooting action
func (p *SimulatedPlayer) SendShot() error {
	if !p.IsConnected || p.Conn == nil {
		return fmt.Errorf("not connected")
	}

	// Calculate random target direction
	dx := rand.Float64()*2 - 1
	dy := rand.Float64()*0.5 - 0.25 // Less vertical variation
	dz := rand.Float64()*2 - 1

	// Normalize
	mag := (dx*dx + dy*dy + dz*dz)
	if mag > 0 {
		mag = 1.0 / mag
		dx *= mag
		dy *= mag
		dz *= mag
	}

	// Create shot message
	shotMsg := map[string]interface{}{
		"type": "action",
		"data": map[string]interface{}{
			"type": "shoot",
			"direction": map[string]float64{
				"x": dx,
				"y": dy,
				"z": dz,
			},
			"weaponId": fmt.Sprintf("weapon_%d", rand.Intn(3)+1),
		},
	}

	// Send message
	err := p.Conn.WriteJSON(shotMsg)
	if err != nil {
		p.Stats.Lock()
		p.Stats.FailedMessages++
		p.Stats.Unlock()
		return fmt.Errorf("error sending shot: %v", err)
	}

	// Record message time
	p.Stats.Lock()
	p.Stats.TotalMessages++
	p.Stats.Unlock()

	return nil
}

// RunSimulation starts the player simulation loop
func (p *SimulatedPlayer) RunSimulation(wg *sync.WaitGroup) {
	defer wg.Done()

	// Connect to server
	err := p.Connect()
	if err != nil {
		log.Printf("Player %s failed to connect: %v", p.ID, err)
		return
	}

	// Start reading messages in a separate goroutine
	go p.readMessages()

	// Action ticker
	actionInterval := time.Duration(1000/p.ActionRate) * time.Millisecond
	ticker := time.NewTicker(actionInterval)
	defer ticker.Stop()

	// Main simulation loop
	for {
		select {
		case <-p.StopChan:
			p.Disconnect()
			return
		case <-ticker.C:
			if !p.IsConnected {
				continue
			}

			// Decide what action to take based on probabilities
			r := rand.Float64()
			if r < p.MovementProb {
				err := p.SendMovement()
				if err != nil && !p.IsConnected {
					p.attemptReconnect()
				}
			} else if r < p.MovementProb+p.ShootingProb {
				err := p.SendShot()
				if err != nil && !p.IsConnected {
					p.attemptReconnect()
				}
			}
			// The remaining probability results in no action (idle)
		}
	}
}
