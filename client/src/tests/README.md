# Testing Framework

This directory contains the testing framework for the client-side components of the Last Circle game. The framework includes unit tests, performance tests, and network simulation tools to ensure the game performs well under various conditions.

## Structure

- `/unit`: Unit tests for game components and utilities
- `/performance`: Performance benchmarks for critical game systems
- `/network`: Network simulation tools for testing under various network conditions

## Running Tests

### Setup

Before running tests for the first time, execute the setup script from the project root:

```bash
./setup-testing.sh
```

This will install all required dependencies and configure the test environment.

### Available Commands

From the project root directory:

```bash
# Run all tests
./run-tests.sh all

# Run only client tests
./run-tests.sh client

# Run only server tests
./run-tests.sh server

# Skip load tests
./run-tests.sh all --skip-load

# Skip performance tests
./run-tests.sh all --skip-performance
```

Alternatively, you can use NPM scripts directly from the client directory:

```bash
# Run unit tests
npm run test:unit

# Run performance tests
npm run test:performance

# Run tests in watch mode (for development)
npm run test:watch

# Run benchmarks
npm run benchmark
```

## Network Simulation

The `NetworkSimulator` class in `/network/NetworkSimulator.ts` provides tools for simulating various network conditions when testing the game. This allows for testing how the game behaves under different connection qualities.

### Example Usage

```typescript
import {
  NetworkSimulator,
  NetworkConditions,
} from "../tests/network/NetworkSimulator";

// Enable network simulation with POOR connection
NetworkSimulator.enable(NetworkConditions.POOR);

// Connect to the game server as usual
// The connection will be automatically simulated with the specified conditions

// Later, disable simulation to restore normal connection
NetworkSimulator.disable();
```

### Available Network Conditions

- `PERFECT`: Ideal connection with no issues
- `GOOD`: Low latency and packet loss
- `AVERAGE`: Moderate latency and occasional packet loss
- `POOR`: High latency and significant packet loss
- `TERRIBLE`: Extremely poor connection quality
- `MOBILE_3G`: Simulates typical 3G mobile connection
- `MOBILE_4G`: Simulates typical 4G mobile connection

You can also create custom network conditions by defining your own `NetworkCondition` object.

## Writing New Tests

### Unit Tests

Place unit tests in the `/unit` directory, following the naming convention `[component].test.ts`.

```typescript
import { describe, it, expect } from "vitest";

describe("Component", () => {
  it("should behave correctly", () => {
    // Test code here
    expect(result).toBe(expectedValue);
  });
});
```

### Performance Tests

Place performance tests in the `/performance` directory, following the naming convention `[system].test.ts`.

```typescript
import { describe, bench } from "vitest";

describe("Performance", () => {
  bench("operation should be fast", () => {
    // Code to benchmark
  });
});
```

## Best Practices

1. Keep tests isolated and deterministic
2. Mock external dependencies
3. Focus on testing behavior, not implementation details
4. Write performance tests for critical systems
5. Test edge cases and error conditions
6. Keep test coverage high for core game systems
