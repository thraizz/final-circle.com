package load

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// TestConfig contains the configuration for the load test
type TestConfig struct {
	NumPlayers    int
	RampupTime    time.Duration
	TestDuration  time.Duration
	ServerURL     string
	ActionRate    float64
	MovementProb  float64
	ShootingProb  float64
	ReconnectProb float64
	Verbose       bool
}

// TestStats contains statistics collected during the test
type TestStats struct {
	TotalConnections     int64
	FailedConnections    int64
	TotalMessages        int64
	FailedMessages       int64
	TotalReconnects      int64
	ConnectionTimes      []time.Duration
	RoundTripTimes       []time.Duration
	mu                   sync.Mutex
	PlayerCount          int64
	MaxConcurrentPlayers int64
	MinRoundTripTime     time.Duration
	MaxRoundTripTime     time.Duration
	AvgRoundTripTime     time.Duration
	MessageRatePerSecond float64
	TestStartTime        time.Time
	TestEndTime          time.Time
}

// SimulatedPlayer represents a simulated player in the load test
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

// Connect establishes a WebSocket connection
func (p *SimulatedPlayer) Connect() error {
	startTime := time.Now()
	conn, _, err := websocket.DefaultDialer.Dial(p.ServerURL, nil)

	if err != nil {
		atomic.AddInt64(&p.Stats.FailedConnections, 1)
		return fmt.Errorf("dial error: %v", err)
	}

	p.Conn = conn
	p.IsConnected = true
	atomic.AddInt64(&p.Stats.TotalConnections, 1)
	atomic.AddInt64(&p.Stats.PlayerCount, 1)

	// Update max concurrent players
	for {
		currentMax := atomic.LoadInt64(&p.Stats.MaxConcurrentPlayers)
		currentCount := atomic.LoadInt64(&p.Stats.PlayerCount)
		if currentCount <= currentMax {
			break
		}
		if atomic.CompareAndSwapInt64(&p.Stats.MaxConcurrentPlayers, currentMax, currentCount) {
			break
		}
	}

	// Register connection time
	p.Stats.mu.Lock()
	p.Stats.ConnectionTimes = append(p.Stats.ConnectionTimes, time.Since(startTime))
	p.Stats.mu.Unlock()

	// Send initial join message with player name
	joinMsg := map[string]interface{}{
		"type": "join",
		"data": map[string]interface{}{
			"displayName": fmt.Sprintf("Bot-%s", p.ID),
		},
	}

	err = p.Conn.WriteJSON(joinMsg)
	if err != nil {
		return fmt.Errorf("error sending join message: %v", err)
	}

	// Start message reader in a separate goroutine
	go p.readMessages()

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
	}

	err := p.Conn.WriteJSON(leaveMsg)
	if err != nil {
		log.Printf("Error sending leave message for player %s: %v", p.ID, err)
	}

	// Close connection
	err = p.Conn.Close()
	p.IsConnected = false
	atomic.AddInt64(&p.Stats.PlayerCount, -1)

	return err
}

// readMessages reads incoming messages from the server
func (p *SimulatedPlayer) readMessages() {
	if p.Conn == nil {
		return
	}

	for {
		_, message, err := p.Conn.ReadMessage()
		if err != nil {
			// Check if connection was closed intentionally
			select {
			case <-p.StopChan:
				return
			default:
				log.Printf("Player %s read error: %v", p.ID, err)
				// Try to reconnect if not stopping
				p.attemptReconnect()
				return
			}
		}

		// Process message if needed
		_ = message // Ignore message content for now
	}
}

// attemptReconnect tries to reconnect after a disconnection
func (p *SimulatedPlayer) attemptReconnect() {
	if !p.IsConnected {
		return
	}

	p.IsConnected = false
	atomic.AddInt64(&p.Stats.PlayerCount, -1)
	atomic.AddInt64(&p.Stats.TotalReconnects, 1)

	// Try to reconnect with exponential backoff
	backoff := 100 * time.Millisecond
	maxBackoff := 5 * time.Second

	for retries := 0; retries < 5; retries++ {
		select {
		case <-p.StopChan:
			return
		case <-time.After(backoff):
			err := p.Connect()
			if err == nil {
				log.Printf("Player %s successfully reconnected", p.ID)
				return
			}

			log.Printf("Player %s reconnect attempt %d failed: %v", p.ID, retries+1, err)
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
		}
	}

	log.Printf("Player %s failed to reconnect after 5 attempts", p.ID)
}

// SendMovement sends a movement action
func (p *SimulatedPlayer) SendMovement() error {
	if !p.IsConnected || p.Conn == nil {
		return fmt.Errorf("not connected")
	}

	// Generate random movement direction
	dx := (rand.Float64() * 2) - 1 // -1 to 1
	dz := (rand.Float64() * 2) - 1 // -1 to 1

	moveMsg := map[string]interface{}{
		"type": "action",
		"data": map[string]interface{}{
			"type": "move",
			"data": map[string]interface{}{
				"direction": map[string]interface{}{
					"x": dx,
					"y": 0.0,
					"z": dz,
				},
			},
		},
	}

	// Measure round trip time with a ping
	pingStart := time.Now()

	err := p.Conn.WriteJSON(moveMsg)
	if err != nil {
		atomic.AddInt64(&p.Stats.FailedMessages, 1)
		return err
	}

	atomic.AddInt64(&p.Stats.TotalMessages, 1)

	// Simulate receiving server acknowledgment
	rtt := time.Since(pingStart)

	// Record round trip time
	p.Stats.mu.Lock()
	p.Stats.RoundTripTimes = append(p.Stats.RoundTripTimes, rtt)

	// Update min/max RTT
	if p.Stats.MinRoundTripTime == 0 || rtt < p.Stats.MinRoundTripTime {
		p.Stats.MinRoundTripTime = rtt
	}
	if rtt > p.Stats.MaxRoundTripTime {
		p.Stats.MaxRoundTripTime = rtt
	}
	p.Stats.mu.Unlock()

	// Update player's position based on movement
	p.Position[0] += dx * 0.1
	p.Position[2] += dz * 0.1

	return nil
}

// SendShot sends a shooting action
func (p *SimulatedPlayer) SendShot() error {
	if !p.IsConnected || p.Conn == nil {
		return fmt.Errorf("not connected")
	}

	// Generate random shot direction
	dx := (rand.Float64() * 2) - 1     // -1 to 1
	dy := (rand.Float64() * 0.2) - 0.1 // Small vertical variation
	dz := (rand.Float64() * 2) - 1     // -1 to 1

	shotMsg := map[string]interface{}{
		"type": "action",
		"data": map[string]interface{}{
			"type": "shoot",
			"data": map[string]interface{}{
				"direction": map[string]interface{}{
					"x": dx,
					"y": dy,
					"z": dz,
				},
			},
		},
	}

	err := p.Conn.WriteJSON(shotMsg)
	if err != nil {
		atomic.AddInt64(&p.Stats.FailedMessages, 1)
		return err
	}

	atomic.AddInt64(&p.Stats.TotalMessages, 1)
	return nil
}

// RunSimulation runs the player simulation
func (p *SimulatedPlayer) RunSimulation(wg *sync.WaitGroup) {
	defer wg.Done()

	// Connect to server
	err := p.Connect()
	if err != nil {
		log.Printf("Player %s failed to connect: %v", p.ID, err)
		return
	}

	ticker := time.NewTicker(time.Duration(1000/p.ActionRate) * time.Millisecond)
	defer ticker.Stop()

	// Simulation loop
	for {
		select {
		case <-p.StopChan:
			p.Disconnect()
			return
		case <-ticker.C:
			// Determine action based on probabilities
			action := rand.Float64()

			if action < p.MovementProb {
				err := p.SendMovement()
				if err != nil {
					log.Printf("Player %s movement error: %v", p.ID, err)
				}
			} else if action < p.MovementProb+p.ShootingProb {
				err := p.SendShot()
				if err != nil {
					log.Printf("Player %s shooting error: %v", p.ID, err)
				}
			}

			// Random chance of disconnection and reconnection
			if rand.Float64() < 0.001 { // 0.1% chance per tick
				log.Printf("Player %s simulating disconnect", p.ID)
				p.Disconnect()

				// Wait a bit before reconnecting
				time.Sleep(500 * time.Millisecond)

				err := p.Connect()
				if err != nil {
					log.Printf("Player %s reconnect error: %v", p.ID, err)
				}
			}
		}
	}
}

// RunLoadTest runs a full load test
func RunLoadTest(config TestConfig) *TestStats {
	log.Printf("Starting load test with %d players connecting to %s",
		config.NumPlayers, config.ServerURL)

	// Initialize statistics
	stats := &TestStats{
		ConnectionTimes:  make([]time.Duration, 0),
		RoundTripTimes:   make([]time.Duration, 0),
		TestStartTime:    time.Now(),
		MinRoundTripTime: 0,
	}

	// Create wait group for players
	var wg sync.WaitGroup

	// Create simulated players
	players := make([]*SimulatedPlayer, config.NumPlayers)
	for i := 0; i < config.NumPlayers; i++ {
		playerID := fmt.Sprintf("player-%d", i+1)
		players[i] = NewSimulatedPlayer(
			playerID,
			config.ServerURL,
			config.ActionRate,
			config.MovementProb,
			config.ShootingProb,
			stats,
		)
	}

	// Start players with rampup
	log.Printf("Ramping up players over %v", config.RampupTime)
	playersPerBatch := 10
	if config.NumPlayers < 10 {
		playersPerBatch = 1
	}

	batches := (config.NumPlayers + playersPerBatch - 1) / playersPerBatch
	batchInterval := config.RampupTime / time.Duration(batches)

	for i := 0; i < config.NumPlayers; i += playersPerBatch {
		end := i + playersPerBatch
		if end > config.NumPlayers {
			end = config.NumPlayers
		}

		// Start a batch of players
		for j := i; j < end; j++ {
			wg.Add(1)
			go players[j].RunSimulation(&wg)
		}

		// Log progress periodically
		if i%50 == 0 && i > 0 {
			log.Printf("Started %d players...", i)
		}

		// Wait before starting next batch (unless it's the last batch)
		if i+playersPerBatch < config.NumPlayers {
			time.Sleep(batchInterval)
		}
	}

	log.Printf("All %d players started, test running for %v",
		config.NumPlayers, config.TestDuration)

	// Run status monitoring in background
	stopMonitor := make(chan struct{})
	go monitorLoadTest(stats, stopMonitor, config.Verbose)

	// Wait for test duration
	time.Sleep(config.TestDuration)

	// Stop the test
	log.Println("Test duration completed, stopping players...")
	for _, player := range players {
		close(player.StopChan)
	}

	// Wait for all players to finish
	wg.Wait()
	close(stopMonitor)

	// Calculate final statistics
	stats.TestEndTime = time.Now()
	testDuration := stats.TestEndTime.Sub(stats.TestStartTime).Seconds()

	if len(stats.RoundTripTimes) > 0 {
		var totalRtt time.Duration
		for _, rtt := range stats.RoundTripTimes {
			totalRtt += rtt
		}
		stats.AvgRoundTripTime = totalRtt / time.Duration(len(stats.RoundTripTimes))
	}

	if testDuration > 0 {
		stats.MessageRatePerSecond = float64(stats.TotalMessages) / testDuration
	}

	printFinalReport(stats)

	return stats
}

// monitorLoadTest prints periodic status during test execution
func monitorLoadTest(stats *TestStats, done chan struct{}, verbose bool) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			stats.Lock()
			currentPlayers := stats.PlayerCount
			totalMessages := stats.TotalMessages
			stats.Unlock()

			if verbose {
				log.Printf("Status: %d active players, %d total messages",
					currentPlayers, totalMessages)
			}
		case <-done:
			return
		}
	}
}

// printFinalReport outputs the final test statistics
func printFinalReport(stats *TestStats) {
	report := stats.PrintStats()

	// Print formatted report
	log.Println("=== Load Test Results ===")
	log.Printf("Test Duration: %.2f seconds", report["test_duration_seconds"])

	connections := report["connections"].(map[string]interface{})
	log.Println("Connections:")
	log.Printf("  Total: %d", connections["total"])
	log.Printf("  Failed: %d (%.2f%%)",
		connections["failed"],
		connections["failure_rate"].(float64)*100)
	log.Printf("  Reconnects: %d", connections["reconnects"])
	log.Printf("  Max Concurrent: %d", connections["max_concurrent"])
	log.Printf("  Avg Connect Time: %.2f ms", connections["avg_connect_time"])

	messages := report["messages"].(map[string]interface{})
	log.Println("Messages:")
	log.Printf("  Total: %d", messages["total"])
	log.Printf("  Failed: %d (%.2f%%)",
		messages["failed"],
		messages["failure_rate"].(float64)*100)
	log.Printf("  Messages/sec: %.2f", messages["per_second"])
	log.Printf("  Round Trip Time: %.2f/%.2f/%.2f ms (min/avg/max)",
		messages["min_round_trip_ms"],
		messages["avg_round_trip_ms"],
		messages["max_round_trip_ms"])

	// Write JSON report to file
	jsonReport, _ := json.MarshalIndent(report, "", "  ")
	reportFile := fmt.Sprintf("load_test_report_%s.json",
		time.Now().Format("20060102_150405"))
	err := os.WriteFile(reportFile, jsonReport, 0644)
	if err != nil {
		log.Printf("Failed to write report file: %v", err)
	} else {
		log.Printf("Detailed report saved to %s", reportFile)
	}
}

// TestMain is the entry point for go test execution
func TestMain(m *testing.M) {
	// Define command line flags
	numPlayers := flag.Int("players", 100, "Number of simulated players")
	duration := flag.Int("duration", 60, "Test duration in seconds")
	rampup := flag.Int("rampup", 30, "Ramp-up time in seconds")
	serverURL := flag.String("server", "ws://localhost:8080/ws", "WebSocket server URL")
	verbose := flag.Bool("verbose", false, "Verbose output")

	flag.Parse()

	// Create test configuration
	config := TestConfig{
		NumPlayers:    *numPlayers,
		RampupTime:    time.Duration(*rampup) * time.Second,
		TestDuration:  time.Duration(*duration) * time.Second,
		ServerURL:     *serverURL,
		ActionRate:    5.0,  // Actions per second
		MovementProb:  0.7,  // 70% chance of movement per action
		ShootingProb:  0.2,  // 20% chance of shooting per action
		ReconnectProb: 0.01, // 1% chance of reconnection simulation
		Verbose:       *verbose,
	}

	// Run the load test
	RunLoadTest(config)

	os.Exit(m.Run())
}
