#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}      Setting up Testing and Optimization Suite        ${NC}"
echo -e "${BLUE}=======================================================${NC}"

# Function to run a command and check its result
run_step() {
  local step_name=$1
  local command=$2
  
  echo -e "\n${YELLOW}[SETUP] ${step_name}...${NC}"
  eval $command
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ${step_name} completed${NC}"
    return 0
  else
    echo -e "${RED}✗ ${step_name} failed${NC}"
    return 1
  fi
}

# Step 1: Install client-side testing dependencies
echo -e "\n${BLUE}=== Client Setup ===${NC}"
if [ -d "./client" ]; then
  run_step "Installing client test dependencies" "cd client && npm install --save-dev vitest @vitest/coverage-v8 jsdom"
  
  # Add test scripts to package.json if they don't exist
  if ! grep -q "\"test:unit\"" ./client/package.json; then
    run_step "Adding test scripts to package.json" "cd client && npm pkg set scripts.test:unit=\"vitest run --config ./vitest.config.ts\" scripts.test:performance=\"vitest run --config ./vitest.performance.config.ts\" scripts.test:watch=\"vitest --config ./vitest.config.ts\" scripts.benchmark=\"vitest bench --config ./vitest.performance.config.ts\""
  fi
else
  echo -e "${RED}Client directory not found. Skipping client setup.${NC}"
fi

# Step 2: Set up server testing structure
echo -e "\n${BLUE}=== Server Setup ===${NC}"
if [ -d "./server" ]; then
  # Create test directories if they don't exist
  run_step "Setting up server test directories" "mkdir -p server/tests/unit server/tests/performance server/tests/load"
else
  echo -e "${RED}Server directory not found. Skipping server setup.${NC}"
fi

# Step 3: Make test runner executable
run_step "Making test runner executable" "chmod +x run-tests.sh"

# Print summary
echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}Setup complete! You can now run tests with ./run-tests.sh${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "Available options:"
echo -e "  ./run-tests.sh all                 - Run all tests"
echo -e "  ./run-tests.sh client              - Run only client tests"
echo -e "  ./run-tests.sh server              - Run only server tests"
echo -e "  ./run-tests.sh all --skip-load     - Skip load tests"
echo -e "  ./run-tests.sh all --skip-performance  - Skip performance tests"
echo -e "${GREEN}============================================================${NC}" 