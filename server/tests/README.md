# Server Testing Framework

This directory contains the testing framework for the server-side components of the Last Circle game. The framework includes unit tests, performance benchmarks, and load tests to ensure the server performs well under various conditions.

## Structure

- `/unit`: Unit tests for server components and utilities
- `/performance`: Performance benchmarks for critical server systems
- `/load`: Load testing tools for simulating multiple concurrent players

## Running Tests

### Setup

Before running tests for the first time, execute the setup script from the project root:

```bash
./setup-testing.sh
```

This will create all required test directories and prepare the testing environment.

### Available Commands

From the project root directory:

```bash
# Run all tests
./run-tests.sh all

# Run only server tests
./run-tests.sh server

# Skip load tests
./run-tests.sh server --skip-load

# Skip performance tests
./run-tests.sh server --skip-performance
```

Alternatively, you can run server tests directly using Go:

```bash
# Run unit tests
go test ./server/tests/unit/...

# Run performance benchmarks
go test -bench=. ./server/tests/performance/...

# Run load tests
go test ./server/tests/load/...
```

## Load Testing

The `server_load_test.go` file in the `/load` directory provides tools for simulating multiple concurrent players connecting to and interacting with the server. This allows for testing how the server behaves under different load conditions.

### Configuration

Load tests can be configured with the following parameters:

```go
type TestConfig struct {
    NumPlayers       int           // Number of simulated players
    RampupTime       time.Duration // Time to gradually add all players
    TestDuration     time.Duration // Total test duration
    ServerURL        string        // Server WebSocket URL
    MoveProb         float64       // Probability of movement action per tick
    ShootProb        float64       // Probability of shooting action per tick
    ReconnectProb    float64       // Probability of reconnection per tick
    TickInterval     time.Duration // Time between player action ticks
    VerboseLogging   bool          // Enable detailed logging
}
```

### Running Custom Load Tests

You can create and run custom load tests with specific configurations:

```go
package main

import (
    "log"
    "time"
    "github.com/yourusername/lastcircle/server/tests/load"
)

func main() {
    config := &load.TestConfig{
        NumPlayers:     500,
        RampupTime:     30 * time.Second,
        TestDuration:   5 * time.Minute,
        ServerURL:      "ws://localhost:8080/ws",
        MoveProb:       0.7,
        ShootProb:      0.3,
        ReconnectProb:  0.01,
        TickInterval:   100 * time.Millisecond,
        VerboseLogging: true,
    }

    stats, err := load.RunLoadTest(config)
    if err != nil {
        log.Fatalf("Load test failed: %v", err)
    }

    log.Printf("Average connection time: %v", stats.AvgConnectTime)
    log.Printf("Average round trip time: %v", stats.AvgRoundTripTime)
    log.Printf("Total messages sent: %d", stats.TotalMessagesSent)
    log.Printf("Total messages received: %d", stats.TotalMessagesReceived)
}
```

## Performance Benchmarks

The performance benchmarks in the `/performance` directory measure server performance under various conditions:

- `BenchmarkStateUpdate`: Tests game state update performance with different player counts
- `BenchmarkPlayerAction`: Measures the performance of handling player actions
- `BenchmarkPlayerJoin`: Assesses the performance of adding new players to the game
- `BenchmarkConcurrentUpdates`: Evaluates the performance of concurrent game state updates

### Running Specific Benchmarks

```bash
# Run all benchmarks
go test -bench=. ./server/tests/performance/...

# Run specific benchmark
go test -bench=BenchmarkStateUpdate ./server/tests/performance/...

# Run benchmarks with memory profiling
go test -bench=. -benchmem ./server/tests/performance/...
```

## Writing New Tests

### Unit Tests

Place unit tests in the `/unit` directory, following the standard Go testing patterns:

```go
package mypackage_test

import (
    "testing"

    "github.com/yourusername/lastcircle/server/path/to/mypackage"
)

func TestSomething(t *testing.T) {
    // Test code here
    result := mypackage.Function()
    if result != expected {
        t.Errorf("Expected %v, got %v", expected, result)
    }
}
```

### Performance Benchmarks

Place performance benchmarks in the `/performance` directory:

```go
package performance_test

import (
    "testing"

    "github.com/yourusername/lastcircle/server/path/to/mypackage"
)

func BenchmarkFunction(b *testing.B) {
    // Setup code

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        // Code to benchmark
        mypackage.Function()
    }
}
```

## Best Practices

1. Keep tests isolated and deterministic
2. Test under realistic conditions
3. Focus on testing behavior, not implementation details
4. Monitor resource usage during tests
5. Test error conditions and edge cases
6. Write benchmarks for performance-critical code
7. Run load tests regularly to catch performance regressions
