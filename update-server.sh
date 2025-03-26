#!/bin/bash
set -e

# Configuration
REMOTE_USER="hkdebiandocker"
REMOTE_HOST="192.168.178.24"
REMOTE_DIR="/home/hkdebiandocker/final-circle"
APP_PORT=8000
LOCAL_SERVER_DIR="./server"

echo "===== Final Circle Backend Update ====="

# Step 1: Build the Go application locally
echo "Building Go application locally..."
cd $LOCAL_SERVER_DIR
GOOS=linux GOARCH=amd64 go build -o final-circle-server main.go
cd ..

# Step 2: Copy the executable to the remote server
echo "Copying updated executable to remote server..."
scp $LOCAL_SERVER_DIR/final-circle-server $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

# Step 3: Restart the application on the remote server
echo "Restarting the application..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && \
  chmod +x final-circle-server && \
  # Check for system-level systemd service with sudo access
  if command -v systemctl >/dev/null 2>&1 && sudo -n systemctl is-active finalcircle.service >/dev/null 2>&1; then
    echo 'Restarting system-level systemd service...' && \
    sudo systemctl restart finalcircle.service && \
    echo 'Service restarted successfully.'
  # Check for user-level systemd service
  elif command -v systemctl >/dev/null 2>&1 && systemctl --user is-active finalcircle.service >/dev/null 2>&1; then
    echo 'Restarting user-level systemd service...' && \
    systemctl --user restart finalcircle.service && \
    echo 'User service restarted successfully.'
  # Check for start-server.sh script
  elif [ -f $REMOTE_DIR/start-server.sh ]; then
    echo 'Restarting standalone process using start-server.sh...' && \
    pkill -f final-circle-server 2>/dev/null || true && \
    ./start-server.sh && \
    echo 'Server restarted in background.'
  # Fall back to direct process restart
  else
    echo 'Restarting standalone process...' && \
    pkill -f final-circle-server 2>/dev/null || true && \
    PORT=$APP_PORT nohup ./final-circle-server > finalcircle.log 2>&1 & \
    echo 'Server restarted in background.'
  fi"

echo "===== Update completed! ====="
echo "The Final Circle backend has been updated and restarted on $REMOTE_HOST:$APP_PORT"
echo ""
echo "To check the server status, run: ./check-status.sh" 