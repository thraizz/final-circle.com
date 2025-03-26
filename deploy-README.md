# Last Circle Backend Deployment Scripts

These scripts help deploy and manage the Last Circle backend on your remote server.

## Requirements

- SSH access to your remote server
- Go installation on your local machine to build the code

## Available Scripts

### `deploy.sh`

Deploys the backend to your remote server using one of three methods:

1. System-level systemd service (if sudo is available without password)
2. User-level systemd service (if user systemd is available)
3. Standalone process with a startup script

Usage:

```bash
./deploy.sh
```

### `update-server.sh`

Updates the backend after code changes with minimal downtime.

Usage:

```bash
./update-server.sh
```

### `check-status.sh`

Checks the status of the backend on the remote server.

Usage:

```bash
./check-status.sh
```

## Configuration

All scripts use the same configuration variables at the top of each file:

- `REMOTE_USER`: SSH username
- `REMOTE_HOST`: IP address of the remote server
- `REMOTE_DIR`: Directory on the remote server to deploy to
- `APP_PORT`: Port the backend will run on (default: 8000)
- `LOCAL_SERVER_DIR`: Directory containing the Go code

## Troubleshooting

### Sudo password issue

If you encounter sudo password issues during deployment, the script will automatically fall back to user-level systemd or standalone mode.

### Manual restart

If you need to restart the server manually, SSH into the server and run:

```bash
# For system-level systemd:
sudo systemctl restart lastcircle.service

# For user-level systemd:
systemctl --user restart lastcircle.service

# For standalone mode:
cd /home/hkdebiandocker/last-circle
./start-server.sh
```

### Viewing logs

To view server logs:

```bash
# For system-level systemd:
sudo journalctl -u lastcircle.service

# For user-level systemd:
journalctl --user -u lastcircle.service

# For standalone mode:
cat /home/hkdebiandocker/last-circle/lastcircle.log
```
