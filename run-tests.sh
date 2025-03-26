#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}      Last Circle - Testing and Optimization Suite     ${NC}"
echo -e "${BLUE}=======================================================${NC}"

# Function to run a command and check its result
run_test() {
  local test_name=$1
  local command=$2
  
  echo -e "\n${YELLOW}Running ${test_name}...${NC}"
  eval $command
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ${test_name} passed${NC}"
    return 0
  else
    echo -e "${RED}✗ ${test_name} failed${NC}"
    return 1
  fi
}

# Check if we have arguments
if [ $# -gt 0 ]; then
  test_type=$1
else
  test_type="all"
fi

# Parse options
skip_client=false
skip_server=false
skip_performance=false
skip_load=false

for arg in "$@"; do
  case $arg in
    --skip-client)
      skip_client=true
      shift
      ;;
    --skip-server)
      skip_server=true
      shift
      ;;
    --skip-performance)
      skip_performance=true
      shift
      ;;
    --skip-load)
      skip_load=true
      shift
      ;;
  esac
done

# Initialize counters
total_tests=0
passed_tests=0

# Client-side tests
if [ "$test_type" = "all" ] || [ "$test_type" = "client" ]; then
  if [ "$skip_client" = false ]; then
    echo -e "\n${BLUE}=== Client Tests ===${NC}"
    
    # Check if Vitest is installed
    if [ -f "./client/node_modules/.bin/vitest" ]; then
      # Run client-side unit tests
      total_tests=$((total_tests + 1))
      if run_test "Client Unit Tests" "cd client && npm run test:unit"; then
        passed_tests=$((passed_tests + 1))
      fi
      
      # Run client-side performance tests if not skipped
      if [ "$skip_performance" = false ]; then
        total_tests=$((total_tests + 1))
        if run_test "Client Performance Tests" "cd client && npm run test:performance"; then
          passed_tests=$((passed_tests + 1))
        fi
      fi
    else
      echo -e "${YELLOW}Vitest not found. Installing test dependencies...${NC}"
      cd client && npm install --save-dev vitest && cd ..
      
      # Add test scripts to package.json if they don't exist
      if ! grep -q "\"test:unit\"" ./client/package.json; then
        echo -e "${YELLOW}Adding test scripts to package.json...${NC}"
        # This is a simple approach; a more robust solution would use jq
        sed -i.bak '/\"scripts\": {/a \
    \"test:unit\": \"vitest run --config ./vitest.config.ts\",\
    \"test:performance\": \"vitest run --config ./vitest.performance.config.ts\",\
    \"test:watch\": \"vitest --config ./vitest.config.ts\",\
        ' ./client/package.json
        rm ./client/package.json.bak
      fi
      
      echo -e "${YELLOW}Please run the tests again after installing dependencies.${NC}"
    fi
  fi
fi

# Server-side tests
if [ "$test_type" = "all" ] || [ "$test_type" = "server" ]; then
  if [ "$skip_server" = false ]; then
    echo -e "\n${BLUE}=== Server Tests ===${NC}"
    
    # Run server-side unit tests
    total_tests=$((total_tests + 1))
    if run_test "Server Unit Tests" "cd server && go test ./tests/unit/..."; then
      passed_tests=$((passed_tests + 1))
    fi
    
    # Run server-side performance tests if not skipped
    if [ "$skip_performance" = false ]; then
      total_tests=$((total_tests + 1))
      if run_test "Server Performance Tests" "cd server && go test -bench=. ./tests/performance/..."; then
        passed_tests=$((passed_tests + 1))
      fi
    fi
    
    # Run server-side load tests if not skipped
    if [ "$skip_load" = false ]; then
      echo -e "\n${YELLOW}Note: Load tests require the server to be running. Make sure it's started first.${NC}"
      read -p "Run load tests? [y/N] " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        total_tests=$((total_tests + 1))
        if run_test "Server Load Tests" "cd server && go test ./tests/load/... -players=50 -duration=30 -server=ws://localhost:8080/ws"; then
          passed_tests=$((passed_tests + 1))
        fi
      else
        echo -e "${YELLOW}Skipping load tests.${NC}"
      fi
    fi
  fi
fi

# Generate performance benchmarks for the report
if [ "$test_type" = "all" ] || [ "$test_type" = "benchmark" ]; then
  if [ "$skip_performance" = false ]; then
    echo -e "\n${BLUE}=== Performance Benchmarks ===${NC}"
    
    # Create benchmark reports directory if it doesn't exist
    mkdir -p ./benchmark-reports
    
    # Client-side performance benchmarks
    if [ "$skip_client" = false ]; then
      total_tests=$((total_tests + 1))
      if run_test "Client Performance Benchmarks" "cd client && npm run benchmark > ../benchmark-reports/client-benchmark-$(date +%Y%m%d-%H%M%S).txt"; then
        passed_tests=$((passed_tests + 1))
      fi
    fi
    
    # Server-side performance benchmarks
    if [ "$skip_server" = false ]; then
      total_tests=$((total_tests + 1))
      if run_test "Server Performance Benchmarks" "cd server && go test -bench=. -benchmem ./tests/performance/... > ../benchmark-reports/server-benchmark-$(date +%Y%m%d-%H%M%S).txt"; then
        passed_tests=$((passed_tests + 1))
      fi
    fi
    
    echo -e "${BLUE}Benchmark reports saved to ./benchmark-reports/${NC}"
  fi
fi

# Print summary
echo -e "\n${BLUE}=======================================================${NC}"
echo -e "${BLUE}                      Test Summary                     ${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo -e "Total tests: ${total_tests}"
echo -e "Passed: ${GREEN}${passed_tests}${NC}"
echo -e "Failed: ${RED}$((total_tests - passed_tests))${NC}"

if [ $passed_tests -eq $total_tests ]; then
  echo -e "\n${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}Some tests failed.${NC}"
  exit 1
fi 