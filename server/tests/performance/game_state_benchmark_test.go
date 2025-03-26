package performance

import (
	"finalcircle/server/game"
	"finalcircle/server/types"
	"math/rand"
	"testing"
)

// BenchmarkStateUpdate measures the performance of the game state update function
// under various load conditions
func BenchmarkStateUpdate(b *testing.B) {
	// Test with different player counts
	playerCounts := []int{10, 50, 100, 500, 1000}

	for _, count := range playerCounts {
		b.Run("PlayerCount_"+string(rune(count)), func(b *testing.B) {
			// Create new state manager with appropriate capacity
			sm := game.NewStateManager(count)

			// Setup test by adding players
			setupPlayers(sm, count)

			// Start the game
			_ = sm.StartGame()

			// Reset timer before the actual benchmark
			b.ResetTimer()

			// Run the benchmark
			for i := 0; i < b.N; i++ {
				sm.Update() // This is the function we're benchmarking
			}
		})
	}
}

// BenchmarkPlayerAction measures the performance of handling player actions
func BenchmarkPlayerAction(b *testing.B) {
	// Setup a state manager with 100 players
	playerCount := 100
	sm := game.NewStateManager(playerCount)

	// Generate player IDs
	playerIDs := setupPlayers(sm, playerCount)

	// Start the game
	_ = sm.StartGame()

	// Reset timer before the actual benchmark
	b.ResetTimer()

	// Run the benchmark
	for i := 0; i < b.N; i++ {
		// Select a random player for each action
		playerIdx := rand.Intn(len(playerIDs))
		playerId := playerIDs[playerIdx]

		// Create a movement action
		action := types.PlayerAction{
			Type: "move",
			Data: types.PlayerActionData{
				Direction: &types.Vector3{
					X: rand.Float64()*2 - 1, // -1 to 1
					Y: 0,
					Z: rand.Float64()*2 - 1, // -1 to 1
				},
			},
		}

		// Process the action
		err := sm.HandlePlayerAction(playerId, action)
		if err != nil {
			b.Logf("Error handling action: %v", err)
		}
	}
}

// BenchmarkPlayerJoin measures the performance of adding new players to the game
func BenchmarkPlayerJoin(b *testing.B) {
	// Create a state manager with large capacity
	sm := game.NewStateManager(10000)

	// Start the game
	_ = sm.StartGame()

	// Reset timer before the actual benchmark
	b.ResetTimer()

	// Run the benchmark
	for i := 0; i < b.N; i++ {
		playerId := generatePlayerID(i)

		// Add a player
		err := sm.AddPlayer(playerId)
		if err != nil {
			b.Logf("Error adding player: %v", err)
		}
	}
}

// BenchmarkConcurrentUpdates measures the performance of concurrent game state updates
func BenchmarkConcurrentUpdates(b *testing.B) {
	// Setup a state manager with 100 players
	playerCount := 100
	sm := game.NewStateManager(playerCount)

	// Generate player IDs
	playerIDs := setupPlayers(sm, playerCount)

	// Start the game
	_ = sm.StartGame()

	// Prepare a set of actions to benchmark
	actions := []types.PlayerAction{
		{
			Type: "move",
			Data: types.PlayerActionData{
				Direction: &types.Vector3{X: 1.0, Y: 0.0, Z: 0.0},
			},
		},
		{
			Type: "shoot",
			Data: types.PlayerActionData{
				Direction: &types.Vector3{X: 0.5, Y: 0.1, Z: 0.5},
			},
		},
		{
			Type: "jump",
		},
	}

	// Reset timer before the actual benchmark
	b.ResetTimer()

	// Run the benchmark
	b.RunParallel(func(pb *testing.PB) {
		// Each goroutine gets a different action to simulate concurrent players
		actionIdx := rand.Intn(len(actions))
		playerIdx := rand.Intn(len(playerIDs))

		for pb.Next() {
			// Process an action
			_ = sm.HandlePlayerAction(playerIDs[playerIdx], actions[actionIdx])

			// Update state
			sm.Update()

			// Change player and action occasionally to simulate real-world usage
			if rand.Float64() < 0.1 {
				actionIdx = rand.Intn(len(actions))
				playerIdx = rand.Intn(len(playerIDs))
			}
		}
	})
}

// Helper to set up players for the benchmark
func setupPlayers(sm *game.StateManager, count int) []string {
	playerIDs := make([]string, count)

	for i := 0; i < count; i++ {
		playerId := generatePlayerID(i)
		playerIDs[i] = playerId

		// Add the player
		_ = sm.AddPlayer(playerId)
	}

	return playerIDs
}

// Helper to generate a unique player ID
func generatePlayerID(index int) string {
	return "player_" + string(rune(index))
}
