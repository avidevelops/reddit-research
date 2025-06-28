#!/bin/zsh

# Log management script for GummyRedditClone

# Load environment variables from .env file if it exists
if [[ -f .env ]]; then
    source .env
fi

# Use environment variables with defaults
LOG_DIR="${LOG_DIR:-${PWD}/logs}"
MAX_LOG_SIZE="${LOG_MAX_SIZE:-10M}"
MAX_LOG_AGE="${LOG_MAX_AGE:-30}"
COMPRESS_LOGS="${LOG_COMPRESS:-true}"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to rotate logs
rotate_logs() {
    local log_file="$1"
    if [[ -f "$log_file" ]]; then
        local size=$(stat -f%z "$log_file")
        if (( size > $(numfmt --from=iec "$MAX_LOG_SIZE") )); then
            local timestamp=$(date +%Y%m%d-%H%M%S)
            mv "$log_file" "${log_file}.${timestamp}"
            if [[ "$COMPRESS_LOGS" == "true" ]]; then
                gzip "${log_file}.${timestamp}"
            fi
            touch "$log_file"
            chmod 644 "$log_file"
        fi
    fi
}

# Function to cleanup old logs
cleanup_old_logs() {
    find "$LOG_DIR" -name "*.log.*" -mtime +"$MAX_LOG_AGE" -delete
}

# Rotate current logs
rotate_logs "$LOG_DIR/error.log"
rotate_logs "$LOG_DIR/combined.log"

# Cleanup old logs
cleanup_old_logs

# Print current log stats
echo "Current log files:"
ls -lh "$LOG_DIR"
