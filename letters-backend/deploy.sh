#!/bin/bash
# VPS Docker Deployment Script for Letters Backend
# Usage: ./deploy.sh [build|start|stop|restart|logs|update]

set -e

APP_NAME="letters-api"
COMPOSE_FILE="docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_env() {
    if [ ! -f .env ]; then
        log_error ".env file not found. Copy .env.example to .env and configure it."
        exit 1
    fi
}

case "$1" in
    build)
        log_info "Building Docker image..."
        docker compose -f $COMPOSE_FILE build --no-cache
        log_info "Build complete."
        ;;
    start)
        check_env
        log_info "Starting $APP_NAME..."
        docker compose -f $COMPOSE_FILE up -d
        log_info "$APP_NAME started. Check logs with: ./deploy.sh logs"
        ;;
    stop)
        log_info "Stopping $APP_NAME..."
        docker compose -f $COMPOSE_FILE down
        log_info "$APP_NAME stopped."
        ;;
    restart)
        log_info "Restarting $APP_NAME..."
        docker compose -f $COMPOSE_FILE restart
        log_info "$APP_NAME restarted."
        ;;
    logs)
        docker compose -f $COMPOSE_FILE logs -f --tail=100
        ;;
    update)
        check_env
        log_info "Updating $APP_NAME..."
        git pull
        docker compose -f $COMPOSE_FILE build --no-cache
        docker compose -f $COMPOSE_FILE up -d
        log_info "Update complete."
        ;;
    status)
        docker compose -f $COMPOSE_FILE ps
        ;;
    *)
        echo "Usage: $0 {build|start|stop|restart|logs|update|status}"
        exit 1
        ;;
esac
