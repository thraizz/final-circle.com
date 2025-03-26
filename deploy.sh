#!/bin/bash
set -e

# Configuration
source .env

APP_PORT=8000
LOCAL_SERVER_DIR="./server"

echo "===== Last Circle Backend Deployment ====="

# Step 1: Build the Go application locally
echo "Building Go application locally..."
cd $LOCAL_SERVER_DIR
GOOS=linux GOARCH=amd64 go build -o last-circle-server main.go
cd ..

# Step 2: Check if remote directory exists, create if not
echo "Setting up remote directory structure..."
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR/static"

# Step 3: Copy the required files to the remote server
echo "Copying files to remote server..."
scp $LOCAL_SERVER_DIR/last-circle-server $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/
scp -r $LOCAL_SERVER_DIR/static/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/static/ 2>/dev/null || echo "No static files to copy"

# Step 4: Create or update the service file for running the application
echo "Creating service configuration..."
cat > systemd-service.txt << EOF
[Unit]
Description=Last Circle Game Server
After=network.target

[Service]
Type=simple
User=$REMOTE_USER
WorkingDirectory=$REMOTE_DIR
ExecStart=$REMOTE_DIR/last-circle-server
Restart=always
RestartSec=10
Environment=PORT=$APP_PORT

[Install]
WantedBy=multi-user.target
EOF

# Copy the service file to the remote server
scp systemd-service.txt $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/lastcircle.service
rm systemd-service.txt

# Step 5: Set up and restart the application on the remote server
echo "Setting up the application service..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && \
  chmod +x last-circle-server && \
  # Check if we can run systemd with sudo without a password
  if command -v systemctl >/dev/null 2>&1 && [ -d /etc/systemd/system ] && sudo -n true 2>/dev/null; then
    echo 'Setting up systemd service (with sudo)...' && \
    sudo mv lastcircle.service /etc/systemd/system/ && \
    sudo systemctl daemon-reload && \
    sudo systemctl enable lastcircle.service && \
    sudo systemctl restart lastcircle.service && \
    echo 'Service status:' && \
    sudo systemctl status lastcircle.service --no-pager
  # Try to set up user-level systemd service if available (doesn't require sudo)
  elif command -v systemctl >/dev/null 2>&1 && [ -d ~/.config/systemd/user ]; then
    echo 'Setting up user systemd service (no sudo required)...' && \
    mkdir -p ~/.config/systemd/user && \
    cp lastcircle.service ~/.config/systemd/user/ && \
    systemctl --user daemon-reload && \
    systemctl --user enable lastcircle.service && \
    systemctl --user restart lastcircle.service && \
    loginctl enable-linger \$USER 2>/dev/null || true && \
    echo 'User service status:' && \
    systemctl --user status lastcircle.service --no-pager
  # Fall back to running as a standalone process
  else
    echo 'Running as standalone process (no systemd)...' && \
    # Kill any existing process
    pkill -f last-circle-server 2>/dev/null || true && \
    # Create a startup script
    echo '#!/bin/bash' > start-server.sh && \
    echo 'cd \"$REMOTE_DIR\"' >> start-server.sh && \
    echo 'PORT=$APP_PORT nohup ./last-circle-server > lastcircle.log 2>&1 &' >> start-server.sh && \
    chmod +x start-server.sh && \
    # Start the server
    ./start-server.sh && \
    echo 'Server started in background. Check lastcircle.log for details.' && \
    echo '' && \
    echo 'To make the server start on boot, add this to crontab (crontab -e):' && \
    echo '@reboot $REMOTE_DIR/start-server.sh'
  fi"

echo "===== Deployment completed! ====="
echo "The Last Circle backend should now be running on $REMOTE_HOST:$APP_PORT" 