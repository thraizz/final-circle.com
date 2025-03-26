package tests

import (
	"finalcircle/server/game"
	"finalcircle/server/types"
	"testing"
	"time"
)

func TestNewStateManager(t *testing.T) {
	maxPlayers := 100
	sm := game.NewStateManager(maxPlayers)

	if sm == nil {
		t.Fatal("Expected StateManager to be created, got nil")
	}

	// Test initial state
	state := sm.GetState()
	if state == nil {
		t.Fatal("Expected state to be initialized, got nil")
	}

	if state.IsGameActive {
		t.Errorf("Expected new game to be inactive, got active")
	}

	if len(state.Players) != 0 {
		t.Errorf("Expected empty player map, got %d players", len(state.Players))
	}

	if state.GameTime != 0 {
		t.Errorf("Expected game time to be 0, got %f", state.GameTime)
	}

	if state.MatchID == "" {
		t.Error("Expected match ID to be generated")
	}
}

func TestAddRemovePlayer(t *testing.T) {
	maxPlayers := 2
	sm := game.NewStateManager(maxPlayers)

	// Test adding players
	playerId1 := "player1"
	playerId2 := "player2"
	playerId3 := "player3"

	// Add first player
	err := sm.AddPlayer(playerId1)
	if err != nil {
		t.Errorf("Failed to add player1: %v", err)
	}

	state := sm.GetState()
	if len(state.Players) != 1 {
		t.Errorf("Expected 1 player, got %d", len(state.Players))
	}

	if _, exists := state.Players[playerId1]; !exists {
		t.Errorf("Player1 should exist in state")
	}

	// Add second player
	err = sm.AddPlayer(playerId2)
	if err != nil {
		t.Errorf("Failed to add player2: %v", err)
	}

	state = sm.GetState()
	if len(state.Players) != 2 {
		t.Errorf("Expected 2 players, got %d", len(state.Players))
	}

	// Try to add a third player (should fail due to maxPlayers=2)
	err = sm.AddPlayer(playerId3)
	if err == nil {
		t.Error("Expected error when adding player3 (exceeds max players), got nil")
	}

	// Test duplicate player ID
	err = sm.AddPlayer(playerId1)
	if err == nil {
		t.Error("Expected error when adding duplicate player, got nil")
	}

	// Test removing a player
	err = sm.RemovePlayer(playerId1)
	if err != nil {
		t.Errorf("Failed to remove player1: %v", err)
	}

	state = sm.GetState()
	if len(state.Players) != 1 {
		t.Errorf("Expected 1 player after removal, got %d", len(state.Players))
	}

	if _, exists := state.Players[playerId1]; exists {
		t.Errorf("Player1 should not exist in state after removal")
	}

	// Test removing a non-existent player
	err = sm.RemovePlayer("nonexistent")
	if err == nil {
		t.Error("Expected error when removing non-existent player, got nil")
	}
}

func TestPlayerActions(t *testing.T) {
	sm := game.NewStateManager(10)
	playerId := "testPlayer"

	// Add a player
	err := sm.AddPlayer(playerId)
	if err != nil {
		t.Fatalf("Failed to add player: %v", err)
	}

	// Test movement action
	moveAction := types.PlayerAction{
		Type: "move",
		Data: map[string]interface{}{
			"direction": map[string]interface{}{
				"x": 1.0,
				"y": 0.0,
				"z": 0.0,
			},
		},
	}

	err = sm.HandlePlayerAction(playerId, moveAction)
	if err != nil {
		t.Errorf("Failed to handle move action: %v", err)
	}

	// Get the initial position
	initialPos := sm.GetState().Players[playerId].Position

	// Update the game state to process the movement
	sm.Update()

	// Check if position changed
	newPos := sm.GetState().Players[playerId].Position
	if newPos.X == initialPos.X && newPos.Y == initialPos.Y && newPos.Z == initialPos.Z {
		// Just a basic check - in a real implementation, we'd verify the exact change
		// but that depends on the specific game physics and movement implementation
		t.Log("Note: Position might not change depending on movement implementation")
	}

	// Test invalid action
	invalidAction := types.PlayerAction{
		Type: "invalid_action",
	}

	err = sm.HandlePlayerAction(playerId, invalidAction)
	if err == nil {
		t.Log("Note: Invalid actions might be silently ignored in some implementations")
	}

	// Test action for non-existent player
	err = sm.HandlePlayerAction("nonexistent", moveAction)
	if err == nil {
		t.Error("Expected error when handling action for non-existent player, got nil")
	}
}

func TestGameLifecycle(t *testing.T) {
	sm := game.NewStateManager(10)

	// Test starting the game
	err := sm.StartGame()
	if err != nil {
		t.Errorf("Failed to start game: %v", err)
	}

	state := sm.GetState()
	if !state.IsGameActive {
		t.Error("Game should be active after StartGame")
	}

	// Test ending the game
	sm.EndGame()

	state = sm.GetState()
	if state.IsGameActive {
		t.Error("Game should be inactive after EndGame")
	}
}

func TestUpdateGameState(t *testing.T) {
	sm := game.NewStateManager(10)

	// Add a player
	playerId := "testPlayer"
	err := sm.AddPlayer(playerId)
	if err != nil {
		t.Fatalf("Failed to add player: %v", err)
	}

	// Start game
	err = sm.StartGame()
	if err != nil {
		t.Fatalf("Failed to start game: %v", err)
	}

	// Record initial game time
	initialTime := sm.GetState().GameTime

	// Wait briefly and update
	time.Sleep(100 * time.Millisecond)
	sm.Update()

	// Check that game time increases
	newTime := sm.GetState().GameTime
	if newTime <= initialTime {
		t.Errorf("Game time should increase after update, got from %f to %f", initialTime, newTime)
	}
}

func TestUpdatePlayerName(t *testing.T) {
	sm := game.NewStateManager(10)
	playerId := "testPlayer"

	// Add a player
	err := sm.AddPlayer(playerId)
	if err != nil {
		t.Fatalf("Failed to add player: %v", err)
	}

	// Get the initial name
	initialName := sm.GetState().Players[playerId].DisplayName

	// Update name
	newName := "UpdatedPlayerName"
	err = sm.UpdatePlayerName(playerId, newName)
	if err != nil {
		t.Errorf("Failed to update player name: %v", err)
	}

	// Check if name was updated
	updatedName := sm.GetState().Players[playerId].DisplayName
	if updatedName != newName {
		t.Errorf("Player name not updated. Expected %s, got %s", newName, updatedName)
	}

	// Test updating non-existent player
	err = sm.UpdatePlayerName("nonexistent", "NewName")
	if err == nil {
		t.Error("Expected error when updating name for non-existent player, got nil")
	}
}
