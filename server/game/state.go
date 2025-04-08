package game

import (
	"math"
	"math/rand"
	"sync"
	"time"

	"finalcircle/server/logger"
	"finalcircle/server/types"
)

// StateManager handles the game state and player management
type StateManager struct {
	mu          sync.RWMutex
	state       *types.GameState
	lastUpdate  time.Time
	updateRate  time.Duration
	maxPlayers  int
	spawnPoints []types.Vector3
}

// NewStateManager creates a new game state manager
func NewStateManager(maxPlayers int) *StateManager {
	return &StateManager{
		state: &types.GameState{
			Players:      make(map[string]*types.Player),
			GameTime:     0,
			IsGameActive: false,
			MatchID:      generateMatchID(),
		},
		lastUpdate:  time.Now(),
		updateRate:  time.Second / 60, // 60 updates per second
		maxPlayers:  maxPlayers,
		spawnPoints: generateSpawnPoints(),
	}
}

// Update updates the game state
func (sm *StateManager) Update() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	deltaTime := now.Sub(sm.lastUpdate).Seconds()
	sm.lastUpdate = now

	// Update game time
	sm.state.GameTime += deltaTime

	// Every 30 seconds, log a game status update
	if int(sm.state.GameTime)%30 == 0 && deltaTime < 0.1 {
		activePlayers := 0
		highestKills := 0
		leadingPlayer := ""

		for id, player := range sm.state.Players {
			if player.IsAlive {
				activePlayers++
			}
			if player.Kills > highestKills {
				highestKills = player.Kills
				leadingPlayer = id
			}
		}

		if sm.state.IsGameActive && len(sm.state.Players) > 0 {
			leaderName := "None"
			if leadingPlayer != "" {
				leaderName = sm.state.Players[leadingPlayer].DisplayName
			}

			logger.InfoLogger.Printf("Game status update - Time: %.1f, Players: %d active/%d total, Leader: %s (%d kills)",
				sm.state.GameTime, activePlayers, len(sm.state.Players),
				leaderName, highestKills)
		}
	}

	// Update player positions and handle actions
	for _, player := range sm.state.Players {
		if !player.IsAlive {
			continue
		}
		// Update player state based on their actions
		// This will be expanded as we add more game mechanics
	}

	// Check for achievements and special events
	sm.checkAchievements()
}

// checkAchievements checks for special game events and achievements
func (sm *StateManager) checkAchievements() {
	if !sm.state.IsGameActive || len(sm.state.Players) < 2 {
		return
	}

	// Find players with killstreaks
	for id, player := range sm.state.Players {
		// This would be better tracked with a dedicated killstreak field
		// For now, we'll just use the current kills as an approximation
		if player.Kills > 0 && player.Kills%5 == 0 && player.IsAlive {
			// Only log once when they reach each multiple of 5
			logger.DebugLogger.Printf("ACHIEVEMENT: Player %s (%s) is on a %d kill streak!",
				id, player.DisplayName, player.Kills)
		}
	}

	// Check for close matches (when two players have similar high scores)
	var topPlayers []struct {
		id    string
		kills int
	}

	for id, player := range sm.state.Players {
		if len(topPlayers) < 2 {
			topPlayers = append(topPlayers, struct {
				id    string
				kills int
			}{id, player.Kills})
			continue
		}

		// Sort top players by kills (simple insertion for just 2 elements)
		if player.Kills > topPlayers[0].kills {
			topPlayers[1] = topPlayers[0]
			topPlayers[0] = struct {
				id    string
				kills int
			}{id, player.Kills}
		} else if player.Kills > topPlayers[1].kills {
			topPlayers[1] = struct {
				id    string
				kills int
			}{id, player.Kills}
		}
	}

	// If we have at least 2 players and they're within 2 kills of each other
	// and both have more than 5 kills, it's a close match
	if len(topPlayers) >= 2 &&
		topPlayers[0].kills > 5 &&
		topPlayers[0].kills-topPlayers[1].kills <= 2 {
		player1 := sm.state.Players[topPlayers[0].id]
		player2 := sm.state.Players[topPlayers[1].id]

		// Log a message about the close match
		logger.DebugLogger.Printf("CLOSE MATCH: %s (%d kills) and %s (%d kills) are in a tight race!",
			player1.DisplayName, player1.Kills,
			player2.DisplayName, player2.Kills)
	}
}

// AddPlayer adds a new player to the game
func (sm *StateManager) AddPlayer(id string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if len(sm.state.Players) >= sm.maxPlayers {
		logger.InfoLogger.Printf("Player join rejected: server full (max: %d)", sm.maxPlayers)
		return types.ErrGameNotActive
	}

	if _, exists := sm.state.Players[id]; exists {
		logger.InfoLogger.Printf("Player join rejected: ID %s already exists", id)
		return types.ErrPlayerAlreadyExists
	}

	// Find a random spawn point
	spawnPoint := sm.getRandomSpawnPoint()

	sm.state.Players[id] = &types.Player{
		ID:          id,
		DisplayName: "Player " + id[:5], // Default name using part of the ID
		Position:    spawnPoint,
		Rotation:    types.Vector3{X: 0, Y: 0, Z: 0},
		Health:      100,
		IsAlive:     true,
		Kills:       0,
		Deaths:      0,
	}

	logger.InfoLogger.Printf("Player added: %s at position (%.2f, %.2f, %.2f), distance from center: %.2f",
		id, spawnPoint.X, spawnPoint.Y, spawnPoint.Z,
		math.Sqrt(spawnPoint.X*spawnPoint.X+spawnPoint.Z*spawnPoint.Z))
	return nil
}

// RemovePlayer removes a player from the game
func (sm *StateManager) RemovePlayer(id string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	player, exists := sm.state.Players[id]
	if !exists {
		logger.InfoLogger.Printf("Player removal failed: ID %s not found", id)
		return types.ErrPlayerNotFound
	}

	logger.DebugLogger.Printf("Player removed: %s (Kills: %d, Deaths: %d)", id, player.Kills, player.Deaths)
	delete(sm.state.Players, id)
	return nil
}

// GetState returns the current game state
func (sm *StateManager) GetState() *types.GameState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.state
}

// HandlePlayerAction handles a player's action
func (sm *StateManager) HandlePlayerAction(id string, action types.PlayerAction) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	player, exists := sm.state.Players[id]
	if !exists {
		logger.InfoLogger.Printf("Action rejected: player %s not found", id)
		return types.ErrPlayerNotFound
	}

	if !player.IsAlive {
		logger.InfoLogger.Printf("Action rejected: player %s is not alive", id)
		return types.ErrGameNotActive
	}

	switch action.Type {
	case "move":
		if action.Data.Position != nil {
			player.Position = *action.Data.Position

		}
		if action.Data.Rotation != nil {
			player.Rotation = *action.Data.Rotation
		}
	case "jump":
		logger.DebugLogger.Printf("Player %s jumped", id)
		// Implement jump mechanics
	case "shoot":
		if action.Data.Target != nil {
			logger.DebugLogger.Printf("Player %s fired a shot at position (%.2f, %.2f, %.2f)",
				id,
				action.Data.Target.X, action.Data.Target.Y, action.Data.Target.Z)
			sm.HandleShot(id, *action.Data.Target)
		} else if action.Data.Direction != nil {
			logger.DebugLogger.Printf("Player %s fired a shot in direction (%.2f, %.2f, %.2f)",
				id,
				action.Data.Direction.X, action.Data.Direction.Y, action.Data.Direction.Z)

			// Check if the shot hit an obstacle
			if action.Data.HitObstacle != nil && *action.Data.HitObstacle {
				// Don't process player hits when an obstacle was hit
				return nil
			}

			sm.HandleDirectionalShot(id, *action.Data.Direction)
		}
	case "reload":
		logger.DebugLogger.Printf("Player %s reloading weapon", id)
		// Implement reload mechanics
	default:
		logger.InfoLogger.Printf("Unknown action type from player %s: %s", id, action.Type)
	}

	return nil
}

// HandleShot handles a player's shot
func (sm *StateManager) HandleShot(shooterId string, target types.Vector3) {
	shooter := sm.state.Players[shooterId]
	hitRegistered := false

	logger.DebugLogger.Printf("Processing shot from player %s", shooterId)
	logger.DebugLogger.Printf("Shot target position: (%.2f, %.2f, %.2f)", target.X, target.Y, target.Z)
	logger.DebugLogger.Printf("Shooter position: (%.2f, %.2f, %.2f)", shooter.Position.X, shooter.Position.Y, shooter.Position.Z)

	// Calculate ray direction from shooter to target
	rayDirection := types.Vector3{
		X: target.X - shooter.Position.X,
		Y: target.Y - shooter.Position.Y,
		Z: target.Z - shooter.Position.Z,
	}

	// Normalize ray direction
	rayLength := math.Sqrt(rayDirection.X*rayDirection.X + rayDirection.Y*rayDirection.Y + rayDirection.Z*rayDirection.Z)
	if rayLength > 0 {
		rayDirection.X /= rayLength
		rayDirection.Y /= rayLength
		rayDirection.Z /= rayLength
	}

	// Log how many potential targets we're checking
	playerCount := 0
	for id, player := range sm.state.Players {
		if id != shooterId && player.IsAlive {
			playerCount++
		}
	}
	logger.DebugLogger.Printf("Checking shot against %d potential targets", playerCount)

	// Find the closest hit player (if any)
	var closestHitPlayer *types.Player
	var closestHitPlayerId string
	closestDistance := math.MaxFloat64

	// Check all players to see if they were hit
	for id, player := range sm.state.Players {
		// Skip the shooter
		if id == shooterId {
			continue
		}

		// Skip already dead players
		if !player.IsAlive {
			continue
		}

		// Calculate vector from shooter to the player
		toPlayer := types.Vector3{
			X: player.Position.X - shooter.Position.X,
			Y: player.Position.Y - shooter.Position.Y,
			Z: player.Position.Z - shooter.Position.Z,
		}

		// Calculate the dot product to find the projection of toPlayer onto rayDirection
		dotProduct := toPlayer.X*rayDirection.X + toPlayer.Y*rayDirection.Y + toPlayer.Z*rayDirection.Z

		// If the player is behind the shooter, skip
		if dotProduct <= 0 {
			logger.DebugLogger.Printf("Player %s is behind the shooter, skipping", id)
			continue
		}

		// Calculate closest point on ray to player
		closestPoint := types.Vector3{
			X: shooter.Position.X + rayDirection.X*dotProduct,
			Y: shooter.Position.Y + rayDirection.Y*dotProduct,
			Z: shooter.Position.Z + rayDirection.Z*dotProduct,
		}

		// Calculate distance from closest point to player (perpendicular distance)
		dx := player.Position.X - closestPoint.X
		dy := player.Position.Y - closestPoint.Y
		dz := player.Position.Z - closestPoint.Z
		perpendicularDistance := math.Sqrt(dx*dx + dy*dy + dz*dz)

		// Calculate a distance-sensitive hit threshold
		// Base threshold is 2.5 units at close range
		// We add 1.5 units per 10 units of distance
		hitThreshold := 2.5 + (dotProduct * 0.15)

		logger.DebugLogger.Printf("Checking player %s at position (%.2f, %.2f, %.2f), distance along ray: %.2f, perpendicular distance: %.2f, hit threshold: %.2f",
			id, player.Position.X, player.Position.Y, player.Position.Z, dotProduct, perpendicularDistance, hitThreshold)

		// If the shot hit (ray passes within the calculated threshold of the player)
		if perpendicularDistance < hitThreshold && dotProduct < closestDistance {
			closestDistance = dotProduct
			closestHitPlayer = player
			closestHitPlayerId = id
		} else {
			logger.DebugLogger.Printf("Shot missed player %s - perpendicular distance %.2f > hit threshold %.2f", id, perpendicularDistance, hitThreshold)
		}
	}

	// Process the hit on the closest player
	if closestHitPlayer != nil {
		oldHealth := closestHitPlayer.Health

		// Reduce health
		closestHitPlayer.Health -= 25 // 4 shots to kill

		logger.DebugLogger.Printf("Player %s hit player %s (health: %d -> %d, distance: %.2f)",
			shooterId, closestHitPlayerId, oldHealth, closestHitPlayer.Health, closestDistance)

		hitRegistered = true

		// Check if player died
		if closestHitPlayer.Health <= 0 {
			closestHitPlayer.IsAlive = false
			closestHitPlayer.Health = 0
			closestHitPlayer.Deaths++
			shooter.Kills++

			logger.InfoLogger.Printf("Player %s killed by %s (kills: %d, deaths: %d)",
				closestHitPlayerId, shooterId, shooter.Kills, closestHitPlayer.Deaths)

			// Respawn player after 3 seconds
			go func(playerId string) {
				logger.DebugLogger.Printf("Player %s will respawn in 3 seconds", playerId)
				time.Sleep(3 * time.Second)
				sm.mu.Lock()
				defer sm.mu.Unlock()

				// Make sure player still exists
				if p, exists := sm.state.Players[playerId]; exists {
					spawnPoint := sm.getRandomSpawnPoint()
					p.IsAlive = true
					p.Health = 100
					p.Position = spawnPoint
					logger.InfoLogger.Printf("Player %s respawned at position (%.2f, %.2f, %.2f), distance from center: %.2f",
						playerId, spawnPoint.X, spawnPoint.Y, spawnPoint.Z,
						math.Sqrt(spawnPoint.X*spawnPoint.X+spawnPoint.Z*spawnPoint.Z))
				} else {
					logger.InfoLogger.Printf("Player %s disconnected while waiting to respawn", playerId)
				}
			}(closestHitPlayerId)
		}
	}

	if !hitRegistered {
		logger.DebugLogger.Printf("Summary: Shot from player %s did not hit any targets", shooterId)
	} else {
		logger.DebugLogger.Printf("Summary: Shot from player %s registered a hit", shooterId)
	}
}

// HandleDirectionalShot handles a shot fired with a direction vector
func (sm *StateManager) HandleDirectionalShot(shooterId string, direction types.Vector3) {
	shooter := sm.state.Players[shooterId]
	hitRegistered := false

	logger.DebugLogger.Printf("Processing directional shot from player %s", shooterId)
	logger.DebugLogger.Printf("Shot direction: (%.2f, %.2f, %.2f)", direction.X, direction.Y, direction.Z)
	logger.DebugLogger.Printf("Shooter position: (%.2f, %.2f, %.2f)", shooter.Position.X, shooter.Position.Y, shooter.Position.Z)

	// Normalize direction
	magnitude := math.Sqrt(direction.X*direction.X + direction.Y*direction.Y + direction.Z*direction.Z)
	if magnitude > 0 {
		direction.X /= magnitude
		direction.Y /= magnitude
		direction.Z /= magnitude
	}

	// Log how many potential targets we're checking
	playerCount := 0
	for id, player := range sm.state.Players {
		if id != shooterId && player.IsAlive {
			playerCount++
		}
	}
	logger.DebugLogger.Printf("Checking shot against %d potential targets", playerCount)

	// Find the closest hit player (if any)
	var closestHitPlayer *types.Player
	var closestHitPlayerId string
	closestDistance := math.MaxFloat64

	// Check all players to see if they were hit
	for id, player := range sm.state.Players {
		// Skip the shooter
		if id == shooterId {
			continue
		}

		// Skip already dead players
		if !player.IsAlive {
			continue
		}

		// Calculate vector from shooter to the player
		toPlayer := types.Vector3{
			X: player.Position.X - shooter.Position.X,
			Y: player.Position.Y - shooter.Position.Y,
			Z: player.Position.Z - shooter.Position.Z,
		}

		// Calculate the dot product to find the projection of toPlayer onto direction
		dotProduct := toPlayer.X*direction.X + toPlayer.Y*direction.Y + toPlayer.Z*direction.Z

		// If the player is behind the shooter, skip
		if dotProduct <= 0 {
			logger.DebugLogger.Printf("Player %s is behind the shooter, skipping", id)
			continue
		}

		// Calculate closest point on ray to player
		closestPoint := types.Vector3{
			X: shooter.Position.X + direction.X*dotProduct,
			Y: shooter.Position.Y + direction.Y*dotProduct,
			Z: shooter.Position.Z + direction.Z*dotProduct,
		}

		// Calculate distance from closest point to player (perpendicular distance)
		dx := player.Position.X - closestPoint.X
		dy := player.Position.Y - closestPoint.Y
		dz := player.Position.Z - closestPoint.Z
		perpendicularDistance := math.Sqrt(dx*dx + dy*dy + dz*dz)

		// Calculate a distance-sensitive hit threshold
		// Base threshold is 2.5 units at close range
		// We add 1.5 units per 10 units of distance
		hitThreshold := 2.5 + (dotProduct * 0.15)

		logger.DebugLogger.Printf("Checking player %s at position (%.2f, %.2f, %.2f), distance along ray: %.2f, perpendicular distance: %.2f, hit threshold: %.2f",
			id, player.Position.X, player.Position.Y, player.Position.Z, dotProduct, perpendicularDistance, hitThreshold)

		// If the shot hit (ray passes within the calculated threshold of the player)
		if perpendicularDistance < hitThreshold && dotProduct < closestDistance {
			closestDistance = dotProduct
			closestHitPlayer = player
			closestHitPlayerId = id
		} else {
			logger.DebugLogger.Printf("Shot missed player %s - perpendicular distance %.2f > hit threshold %.2f", id, perpendicularDistance, hitThreshold)
		}
	}

	// Process the hit on the closest player
	if closestHitPlayer != nil {
		oldHealth := closestHitPlayer.Health

		// Reduce health
		closestHitPlayer.Health -= 25 // 4 shots to kill

		logger.DebugLogger.Printf("Player %s hit player %s (health: %d -> %d, distance: %.2f)",
			shooterId, closestHitPlayerId, oldHealth, closestHitPlayer.Health, closestDistance)

		hitRegistered = true

		// Check if player died
		if closestHitPlayer.Health <= 0 {
			closestHitPlayer.IsAlive = false
			closestHitPlayer.Health = 0
			closestHitPlayer.Deaths++
			shooter.Kills++

			logger.InfoLogger.Printf("Player %s killed by %s (kills: %d, deaths: %d)",
				closestHitPlayerId, shooterId, shooter.Kills, closestHitPlayer.Deaths)

			// Respawn player after 3 seconds
			go func(playerId string) {
				logger.DebugLogger.Printf("Player %s will respawn in 3 seconds", playerId)
				time.Sleep(3 * time.Second)
				sm.mu.Lock()
				defer sm.mu.Unlock()

				// Make sure player still exists
				if p, exists := sm.state.Players[playerId]; exists {
					spawnPoint := sm.getRandomSpawnPoint()
					p.IsAlive = true
					p.Health = 100
					p.Position = spawnPoint
					logger.InfoLogger.Printf("Player %s respawned at position (%.2f, %.2f, %.2f), distance from center: %.2f",
						playerId, spawnPoint.X, spawnPoint.Y, spawnPoint.Z,
						math.Sqrt(spawnPoint.X*spawnPoint.X+spawnPoint.Z*spawnPoint.Z))
				} else {
					logger.InfoLogger.Printf("Player %s disconnected while waiting to respawn", playerId)
				}
			}(closestHitPlayerId)
		}
	}

	if !hitRegistered {
		logger.DebugLogger.Printf("Summary: Shot from player %s did not hit any targets", shooterId)
	} else {
		logger.DebugLogger.Printf("Summary: Shot from player %s registered a hit", shooterId)
	}
}

// StartGame starts a new game
func (sm *StateManager) StartGame() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if len(sm.state.Players) < 2 {
		logger.InfoLogger.Printf("Game start rejected: not enough players (%d/2)", len(sm.state.Players))
		return types.ErrGameNotActive
	}

	sm.state.IsGameActive = true
	sm.state.GameTime = 0
	logger.InfoLogger.Printf("Game started: %s with %d players", sm.state.MatchID, len(sm.state.Players))
	return nil
}

// EndGame ends the current game
func (sm *StateManager) EndGame() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.state.IsGameActive = false
	sm.state.GameTime = 0
	logger.InfoLogger.Printf("Game ended: %s, total time: %.2f seconds", sm.state.MatchID, sm.state.GameTime)
}

// getRandomSpawnPoint returns a random spawn point
func (sm *StateManager) getRandomSpawnPoint() types.Vector3 {
	// If there are no spawn points defined, create one randomly within the circle
	if len(sm.spawnPoints) == 0 {
		return generateRandomPointInCircle(0, 0, 800.0) // Fallback with default circle radius
	}

	// Create a properly seeded random source
	source := rand.NewSource(time.Now().UnixNano())
	r := rand.New(source)

	// Pick a random spawn point from the available ones
	randomIndex := r.Intn(len(sm.spawnPoints))

	return sm.spawnPoints[randomIndex]
}

// generateMatchID generates a unique match ID
func generateMatchID() string {
	return time.Now().Format("20060102150405")
}

// generateSpawnPoints generates initial spawn points within the play area circle
func generateSpawnPoints() []types.Vector3 {
	// Center of the circle
	centerX := 0.0
	centerY := 0.0

	// Radius of the spawn area circle - matches the ringWallRadius in GameMap.ts
	circleRadius := 800.0

	// Number of spawn points to generate
	spawnPointCount := 20

	spawnPoints := make([]types.Vector3, spawnPointCount)

	// Create spawn points randomly distributed within the circle
	for i := 0; i < spawnPointCount; i++ {
		spawnPoints[i] = generateRandomPointInCircle(centerX, centerY, circleRadius)
	}

	return spawnPoints
}

// generateRandomPointInCircle creates a random position within a circle
func generateRandomPointInCircle(centerX, centerY, radius float64) types.Vector3 {
	// Create a properly seeded random source
	source := rand.NewSource(time.Now().UnixNano())
	r := rand.New(source)

	// Generate random angle
	angle := r.Float64() * 2 * math.Pi

	// Generate random radius (use square root for uniform distribution)
	// Random value between 0.3 and 0.95 of the circle radius to avoid edge spawns
	radiusFactor := 0.3 + (r.Float64() * 0.65)
	distance := radius * radiusFactor

	// Calculate position
	x := centerX + math.Cos(angle)*distance
	z := centerY + math.Sin(angle)*distance

	return types.Vector3{
		X: x,
		Y: 0.0, // Spawn at ground level
		Z: z,
	}
}

// UpdatePlayerName updates a player's display name
func (sm *StateManager) UpdatePlayerName(id string, displayName string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	player, exists := sm.state.Players[id]
	if !exists {
		logger.InfoLogger.Printf("Set name failed: player %s not found", id)
		return types.ErrPlayerNotFound
	}

	oldName := player.DisplayName
	player.DisplayName = displayName
	logger.DebugLogger.Printf("Player %s changed name: '%s' -> '%s'", id, oldName, displayName)
	return nil
}
