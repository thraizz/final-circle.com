package load

import (
	"sync"
	"time"
)

// TestStats collects statistics during load testing
type TestStats struct {
	mu sync.Mutex // Mutex for thread-safe access

	// Connection statistics
	TotalConnections     int64
	FailedConnections    int64
	TotalReconnects      int64
	ConnectionTimes      []time.Duration
	PlayerCount          int64
	MaxConcurrentPlayers int64

	// Message statistics
	TotalMessages     int64
	FailedMessages    int64
	RoundTripTimes    []time.Duration
	MinRoundTripTime  time.Duration
	MaxRoundTripTime  time.Duration
	AvgRoundTripTime  time.Duration
	MessagesPerSecond float64

	// Test metadata
	TestStartTime time.Time
	TestEndTime   time.Time
	TestDuration  time.Duration
}

// NewTestStats creates a new TestStats instance
func NewTestStats() *TestStats {
	return &TestStats{
		TestStartTime:    time.Now(),
		MinRoundTripTime: time.Hour, // Initialize with high value to be lowered
	}
}

// Lock acquires the mutex
func (ts *TestStats) Lock() {
	ts.mu.Lock()
}

// Unlock releases the mutex
func (ts *TestStats) Unlock() {
	ts.mu.Unlock()
}

// CalculateStats processes the raw statistics and calculates derived metrics
func (ts *TestStats) CalculateStats() {
	ts.Lock()
	defer ts.Unlock()

	ts.TestEndTime = time.Now()
	ts.TestDuration = ts.TestEndTime.Sub(ts.TestStartTime)

	// Calculate round trip time stats
	if len(ts.RoundTripTimes) > 0 {
		var total time.Duration
		for _, rtt := range ts.RoundTripTimes {
			total += rtt
			if rtt < ts.MinRoundTripTime {
				ts.MinRoundTripTime = rtt
			}
			if rtt > ts.MaxRoundTripTime {
				ts.MaxRoundTripTime = rtt
			}
		}
		ts.AvgRoundTripTime = total / time.Duration(len(ts.RoundTripTimes))
	}

	// Calculate messages per second
	durationSec := ts.TestDuration.Seconds()
	if durationSec > 0 {
		ts.MessagesPerSecond = float64(ts.TotalMessages) / durationSec
	}
}

// PrintStats returns a formatted statistics report
func (ts *TestStats) PrintStats() map[string]interface{} {
	ts.Lock()
	defer ts.Unlock()

	// Generate a report structure
	return map[string]interface{}{
		"test_duration_seconds": ts.TestDuration.Seconds(),
		"connections": map[string]interface{}{
			"total":            ts.TotalConnections,
			"failed":           ts.FailedConnections,
			"reconnects":       ts.TotalReconnects,
			"failure_rate":     float64(ts.FailedConnections) / float64(ts.TotalConnections+ts.FailedConnections),
			"max_concurrent":   ts.MaxConcurrentPlayers,
			"avg_connect_time": getAverageDuration(ts.ConnectionTimes),
		},
		"messages": map[string]interface{}{
			"total":             ts.TotalMessages,
			"failed":            ts.FailedMessages,
			"failure_rate":      float64(ts.FailedMessages) / float64(ts.TotalMessages+ts.FailedMessages),
			"per_second":        ts.MessagesPerSecond,
			"min_round_trip_ms": float64(ts.MinRoundTripTime) / float64(time.Millisecond),
			"max_round_trip_ms": float64(ts.MaxRoundTripTime) / float64(time.Millisecond),
			"avg_round_trip_ms": float64(ts.AvgRoundTripTime) / float64(time.Millisecond),
		},
	}
}

// Helper function to calculate average duration
func getAverageDuration(durations []time.Duration) float64 {
	if len(durations) == 0 {
		return 0
	}

	var total time.Duration
	for _, d := range durations {
		total += d
	}

	avg := total / time.Duration(len(durations))
	return float64(avg) / float64(time.Millisecond)
}
