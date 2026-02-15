#!/bin/bash
set -e

# Define target paths
CRED_SOURCE="/tmp/claude_credentials"
CRED_DIR="/home/capybara/.claude"
CRED_TARGET="$CRED_DIR/.credentials.json"

# If credentials mounted at /tmp/claude_credentials, copy them
if [ -f "$CRED_SOURCE" ]; then
    echo "Entrypoint: Found mounted credentials at $CRED_SOURCE"
    
    # Create directory if missing
    if [ ! -d "$CRED_DIR" ]; then
        echo "Entrypoint: Creating $CRED_DIR..."
        mkdir -p "$CRED_DIR"
    fi

    # Copy file
    echo "Entrypoint: Copying credentials to $CRED_TARGET..."
    cp "$CRED_SOURCE" "$CRED_TARGET"
    
    # Fix permissions
    echo "Entrypoint: Fixing permissions for $CRED_DIR..."
    chown -R capybara:capybara "$CRED_DIR"
    chmod 600 "$CRED_TARGET"
    
    echo "Entrypoint: Credentials setup complete."
else
    echo "Entrypoint: No credentials mounted at $CRED_SOURCE. Skipping copy."
fi

# Execute command as capybara user
exec gosu capybara "$@"
