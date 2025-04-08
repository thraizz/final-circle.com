package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"finalcircle/server/config"
	"finalcircle/server/game"
	"finalcircle/server/logger"
	"finalcircle/server/types"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// WebsocketClient represents a connected WebSocket client
type WebsocketClient struct {
	ID     string
	Conn   *websocket.Conn
	Send   chan []byte
	GameID string
}

type GameServer struct {
	stateManager *game.StateManager
	clients      map[string]*WebsocketClient
	clientsMu    sync.RWMutex
	upgrader     websocket.Upgrader
	startTime    time.Time
}

func newGameServer() (*GameServer, error) {
	gs := &GameServer{
		stateManager: game.NewStateManager(50), // Max 50 players
		clients:      make(map[string]*WebsocketClient),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
		startTime: time.Now(),
	}

	logger.InfoLogger.Printf("Game server initialized with max players: 50")
	return gs, nil
}

// handleWebSocket upgrades HTTP connections to WebSocket connections
func (gs *GameServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	log.Printf("WebSocket connection requested from: %s", r.RemoteAddr)
	conn, err := gs.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading to WebSocket from %s: %v", r.RemoteAddr, err)
		return
	}

	// Generate a player ID
	playerId := uuid.New().String()

	// Create a new client
	client := &WebsocketClient{
		ID:   playerId,
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	// Register the client
	gs.clientsMu.Lock()
	gs.clients[playerId] = client
	gs.clientsMu.Unlock()

	// Add player to game state
	if err := gs.stateManager.AddPlayer(playerId); err != nil {
		log.Printf("Error adding player %s to game state: %v", playerId, err)
		conn.Close()
		return
	}

	log.Printf("Client connected: %s from %s", playerId, conn.RemoteAddr().String())

	// Send player ID to client
	idMsg := map[string]interface{}{
		"type": "playerId",
		"payload": map[string]string{
			"id": playerId,
		},
		"timestamp": time.Now().Unix(),
	}
	idJSON, _ := json.Marshal(idMsg)
	client.Send <- idJSON
	log.Printf("Sent player ID to client: %s", playerId)

	// Start goroutines for reading and writing
	go gs.readPump(client)
	go gs.writePump(client)
	log.Printf("Started communication handlers for client: %s", playerId)

	// Send initial game state
	state := gs.stateManager.GetState()
	stateMsg := map[string]interface{}{
		"type":      "gameState",
		"payload":   state,
		"timestamp": time.Now().Unix(),
	}
	stateJSON, _ := json.Marshal(stateMsg)
	client.Send <- stateJSON
	log.Printf("Sent initial game state to client: %s", playerId)
}

// readPump pumps messages from the WebSocket to the server
func (gs *GameServer) readPump(client *WebsocketClient) {
	defer func() {
		gs.clientDisconnect(client)
	}()

	client.Conn.SetReadLimit(512 * 1024) // 512KB max message size
	client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.Conn.SetPongHandler(func(string) error {
		client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		log.Printf("Received pong from client: %s", client.ID)
		return nil
	})

	log.Printf("Started read pump for client: %s", client.ID)

	for {
		_, message, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error for client %s: %v", client.ID, err)
			} else {
				log.Printf("Client %s disconnected: %v", client.ID, err)
			}
			break
		}

		// Process the message
		gs.handleMessage(client, message)
	}
}

// writePump pumps messages from the server to the WebSocket
func (gs *GameServer) writePump(client *WebsocketClient) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		client.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// The channel was closed
				client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := client.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(client.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-client.Send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := client.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming WebSocket messages
func (gs *GameServer) handleMessage(client *WebsocketClient, message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("Error unmarshaling message from client %s: %v", client.ID, err)
		return
	}

	msgType, ok := msg["type"].(string)
	if !ok {
		log.Printf("Message from client %s missing 'type' field", client.ID)
		return
	}

	payload, ok := msg["payload"].(map[string]interface{})
	if !ok {
		log.Printf("Message from client %s missing 'payload' field", client.ID)
		return
	}

	switch msgType {
	case "setName":
		displayName, ok := payload["displayName"].(string)
		if !ok {
			log.Printf("setName message from client %s missing displayName", client.ID)
			return
		}

		log.Printf("Client %s setting name to: '%s'", client.ID, displayName)

		if err := gs.stateManager.UpdatePlayerName(client.ID, displayName); err != nil {
			log.Printf("Error updating player name for client %s: %v", client.ID, err)
			errMsg := map[string]interface{}{
				"type": "error",
				"payload": map[string]string{
					"code":    "NAME_ERROR",
					"message": err.Error(),
				},
				"timestamp": time.Now().Unix(),
			}
			errJSON, _ := json.Marshal(errMsg)
			client.Send <- errJSON
		}

	case "playerAction":
		action := types.PlayerAction{}
		action.Type, _ = payload["type"].(string)

		if actionData, ok := payload["data"].(map[string]interface{}); ok {
			// Handle position
			if posData, ok := actionData["position"].(map[string]interface{}); ok {
				position := &types.Vector3{}
				if x, ok := posData["x"].(float64); ok {
					position.X = x
				}
				if y, ok := posData["y"].(float64); ok {
					position.Y = y
				}
				if z, ok := posData["z"].(float64); ok {
					position.Z = z
				}
				action.Data.Position = position
			}

			// Handle rotation
			if rotData, ok := actionData["rotation"].(map[string]interface{}); ok {
				rotation := &types.Vector3{}
				if x, ok := rotData["x"].(float64); ok {
					rotation.X = x
				}
				if y, ok := rotData["y"].(float64); ok {
					rotation.Y = y
				}
				if z, ok := rotData["z"].(float64); ok {
					rotation.Z = z
				}
				action.Data.Rotation = rotation
			}

			// Handle target
			if targetData, ok := actionData["target"].(map[string]interface{}); ok {
				target := &types.Vector3{}
				if x, ok := targetData["x"].(float64); ok {
					target.X = x
				}
				if y, ok := targetData["y"].(float64); ok {
					target.Y = y
				}
				if z, ok := targetData["z"].(float64); ok {
					target.Z = z
				}
				action.Data.Target = target
			}

			// Handle direction
			if dirData, ok := actionData["direction"].(map[string]interface{}); ok {
				direction := &types.Vector3{}
				if x, ok := dirData["x"].(float64); ok {
					direction.X = x
				}
				if y, ok := dirData["y"].(float64); ok {
					direction.Y = y
				}
				if z, ok := dirData["z"].(float64); ok {
					direction.Z = z
				}
				action.Data.Direction = direction
			}

			// Handle weaponId
			if weaponId, ok := actionData["weaponId"].(string); ok {
				action.Data.WeaponID = weaponId
			}

			// Handle hitObstacle
			if hitObstacle, ok := actionData["hitObstacle"].(bool); ok {
				boolVal := hitObstacle
				action.Data.HitObstacle = &boolVal

				// Handle hitPoint if there's an obstacle hit
				if hitPointData, ok := actionData["hitPoint"].(map[string]interface{}); ok {
					hitPoint := &types.Vector3{}
					if x, ok := hitPointData["x"].(float64); ok {
						hitPoint.X = x
					}
					if y, ok := hitPointData["y"].(float64); ok {
						hitPoint.Y = y
					}
					if z, ok := hitPointData["z"].(float64); ok {
						hitPoint.Z = z
					}
					action.Data.HitPoint = hitPoint
				}

				// Handle hitDistance
				if hitDistance, ok := actionData["hitDistance"].(float64); ok {
					distance := hitDistance
					action.Data.HitDistance = &distance
				}
			}
		}

		if err := gs.stateManager.HandlePlayerAction(client.ID, action); err != nil {
			log.Printf("Error handling action '%s' from client %s: %v", action.Type, client.ID, err)
			errMsg := map[string]interface{}{
				"type": "error",
				"payload": map[string]string{
					"code":    "ACTION_ERROR",
					"message": err.Error(),
				},
				"timestamp": time.Now().Unix(),
			}
			errJSON, _ := json.Marshal(errMsg)
			client.Send <- errJSON
		}
	default:
		log.Printf("Received unknown message type '%s' from client %s", msgType, client.ID)
	}
}

// clientDisconnect handles client disconnection
func (gs *GameServer) clientDisconnect(client *WebsocketClient) {
	gs.clientsMu.Lock()
	defer gs.clientsMu.Unlock()

	// Check if client exists
	if _, ok := gs.clients[client.ID]; !ok {
		return
	}

	log.Printf("Client disconnecting: %s", client.ID)

	// Remove player from game state
	gs.stateManager.RemovePlayer(client.ID)

	// Close connection
	client.Conn.Close()

	// Delete client
	delete(gs.clients, client.ID)

	log.Printf("Client disconnected and removed: %s", client.ID)

	// Broadcast updated game state
	go gs.broadcastGameState(gs.stateManager.GetState())
}

// broadcastGameState broadcasts the game state to all clients
func (gs *GameServer) broadcastGameState(state *types.GameState) {
	gs.clientsMu.RLock()
	defer gs.clientsMu.RUnlock()

	// Create state message
	stateMsg := map[string]interface{}{
		"type":      "gameState",
		"payload":   state,
		"timestamp": time.Now().Unix(),
	}
	stateJSON, err := json.Marshal(stateMsg)
	if err != nil {
		log.Printf("Error marshaling game state: %v", err)
		return
	}

	// Send to all clients
	for _, client := range gs.clients {
		select {
		case client.Send <- stateJSON:
			// Message sent successfully
		default:
			// Client send buffer is full, disconnect client
			log.Printf("Client %s send buffer full, disconnecting", client.ID)
			gs.clientDisconnect(client)
		}
	}
}

// run updates and broadcasts the game state at regular intervals
func (gs *GameServer) run() {
	ticker := time.NewTicker(time.Second / 20) // 20 updates per second
	defer ticker.Stop()

	log.Printf("Game server loop started at %d updates per second", 20)

	updateCount := 0
	for range ticker.C {
		gs.stateManager.Update()
		gs.broadcastGameState(gs.stateManager.GetState())

		updateCount++
		if updateCount%100 == 0 { // Log every 100 updates (about 5 seconds)
			gs.clientsMu.RLock()
			playerCount := len(gs.clients)
			gs.clientsMu.RUnlock()
			state := gs.stateManager.GetState()
			log.Printf("Server status: %d clients connected, game active: %v, game time: %.2f",
				playerCount, state.IsGameActive, state.GameTime)
		}
	}
}

func (gs *GameServer) close() {
	gs.clientsMu.Lock()
	for _, client := range gs.clients {
		client.Conn.Close()
	}
	gs.clients = make(map[string]*WebsocketClient)
	gs.clientsMu.Unlock()
}

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Initialize logger based on environment
	logger.Init(cfg.IsDevelopment)

	logger.InfoLogger.Printf("Server starting on :%s (TLS: %v, Environment: %s)",
		cfg.Port, cfg.UseTLS, map[bool]string{true: "development", false: "production"}[cfg.IsDevelopment])

	gs, err := newGameServer()
	if err != nil {
		logger.ErrorLogger.Fatalf("Failed to create game server: %v", err)
	}

	// Start the game server loop
	go gs.run()
	logger.InfoLogger.Printf("Game loop started")

	// Set up HTTP routes
	// Using http.ServeMux instead of gorilla/mux
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", gs.handleWebSocket)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		logger.DebugLogger.Printf("Health check received")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		logger.DebugLogger.Printf("Status request received")
		gs.clientsMu.RLock()
		clientCount := len(gs.clients)
		gs.clientsMu.RUnlock()

		state := gs.stateManager.GetState()
		status := map[string]interface{}{
			"clients":      clientCount,
			"gameActive":   state.IsGameActive,
			"gameTime":     state.GameTime,
			"matchId":      state.MatchID,
			"serverUptime": time.Since(gs.startTime).String(),
		}

		json.NewEncoder(w).Encode(status)
		logger.DebugLogger.Printf("Status request: %d clients, game active: %v", clientCount, state.IsGameActive)
	})

	// API endpoints for game control
	mux.HandleFunc("/api/game/start", func(w http.ResponseWriter, r *http.Request) {
		logger.DebugLogger.Printf("API request to start game received")
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		err := gs.stateManager.StartGame()
		if err != nil {
			logger.ErrorLogger.Printf("Failed to start game: %v", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		logger.InfoLogger.Printf("Game started via API")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Game started"))

		// Broadcast updated game state
		go gs.broadcastGameState(gs.stateManager.GetState())
	})

	mux.HandleFunc("/api/game/end", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		logger.DebugLogger.Printf("API request to end game received")
		gs.stateManager.EndGame()
		logger.InfoLogger.Printf("Game ended via API")

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Game ended"))

		// Broadcast updated game state
		go gs.broadcastGameState(gs.stateManager.GetState())
	})

	// Handle static files
	staticDir := http.Dir("./static")
	staticFileServer := http.FileServer(staticDir)
	mux.Handle("/", staticFileServer)

	// Add CORS middleware
	handler := corsMiddleware(mux)

	// Start HTTP server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	logger.InfoLogger.Printf("HTTP server listening on :%s", cfg.Port)

	// Use TLS if cert and key files are provided
	if cfg.UseTLS {
		logger.InfoLogger.Printf("Starting server with TLS using cert: %s and key: %s", cfg.CertFile, cfg.KeyFile)
		if err := server.ListenAndServeTLS(cfg.CertFile, cfg.KeyFile); err != nil {
			logger.ErrorLogger.Fatalf("Failed to start TLS server: %v", err)
		}
	} else {
		logger.InfoLogger.Printf("Starting server without TLS")
		if err := server.ListenAndServe(); err != nil {
			logger.ErrorLogger.Fatalf("Failed to start server: %v", err)
		}
	}
}

// CORS middleware function
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
