#!/bin/bash

# Configuration
REMOTE_USER="hkdebiandocker"
REMOTE_HOST="192.168.178.24"
REMOTE_DIR="/home/hkdebiandocker/final-circle"
APP_PORT=8000

echo "===== Final Circle Backend Status Check ====="

# Check if we can connect to the server
if ssh -q $REMOTE_USER@$REMOTE_HOST exit; then
  echo "✓ SSH connection successful"
else
  echo "✗ Failed to connect via SSH"
  exit 1
fi

# Check if the process is running
echo "Checking if server process is running..."
SSH_RESULT=$(ssh $REMOTE_USER@$REMOTE_HOST "pgrep -f final-circle-server >/dev/null && echo 'running' || echo 'not running'")

if [ "$SSH_RESULT" = "running" ]; then
  echo "✓ Server process is running"
else
  echo "✗ Server process is not running"
fi

# Check all possible service configurations
echo "Checking service status..."
SSH_SYSTEM_SERVICE=$(ssh $REMOTE_USER@$REMOTE_HOST "command -v systemctl >/dev/null 2>&1 && sudo -n systemctl is-active finalcircle.service 2>/dev/null || echo 'not found'")
SSH_USER_SERVICE=$(ssh $REMOTE_USER@$REMOTE_HOST "command -v systemctl >/dev/null 2>&1 && systemctl --user is-active finalcircle.service 2>/dev/null || echo 'not found'")
SSH_STARTUP_SCRIPT=$(ssh $REMOTE_USER@$REMOTE_HOST "[ -f $REMOTE_DIR/start-server.sh ] && echo 'exists' || echo 'not found'")

if [ "$SSH_SYSTEM_SERVICE" = "active" ]; then
  echo "✓ System-level systemd service is active"
elif [ "$SSH_USER_SERVICE" = "active" ]; then
  echo "✓ User-level systemd service is active"
elif [ "$SSH_STARTUP_SCRIPT" = "exists" ]; then
  echo "✓ Using standalone startup script (start-server.sh)"
else
  echo "✗ No recognized service configuration found"
fi

# Check if the port is listening
echo "Checking if port $APP_PORT is open..."
SSH_PORT_CHECK=$(ssh $REMOTE_USER@$REMOTE_HOST "ss -tuln | grep :$APP_PORT >/dev/null && echo 'open' || echo 'closed'")

if [ "$SSH_PORT_CHECK" = "open" ]; then
  echo "✓ Port $APP_PORT is open and listening"
else
  echo "✗ Port $APP_PORT is not listening"
fi

# Try to get server status via API
echo "Checking server health API..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:$APP_PORT/health 2>/dev/null || echo "failed")

if [ "$HEALTH_CHECK" = "200" ]; then
  echo "✓ Health check successful (HTTP 200)"
  echo "Fetching server status..."
  STATUS_JSON=$(curl -s http://$REMOTE_HOST:$APP_PORT/status)
  echo "$STATUS_JSON" | grep -v '^\s*$' | sed 's/^/  /'
else
  echo "✗ Health check failed (HTTP $HEALTH_CHECK)"
fi

# Check server log if available
echo "Checking server logs (last 5 lines)..."
ssh $REMOTE_USER@$REMOTE_HOST "if [ -f $REMOTE_DIR/finalcircle.log ]; then 
  tail -n 5 $REMOTE_DIR/finalcircle.log | sed 's/^/  /'; 
else 
  echo '  No log file found'; 
fi"

echo "===== Status Check Completed =====" 