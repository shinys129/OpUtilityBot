#!/bin/sh
set -e

# Run from the directory containing this script
cd "$(dirname "$0")"

# Install dependencies if requirements.txt exists
if [ -f requirements.txt ]; then
  echo "Installing Python dependencies from requirements.txt..."
  pip install --no-cache-dir -r requirements.txt
fi

# Create config.ini from environment variables if not present
if [ ! -f config.ini ]; then
  cat > config.ini <<EOF
[DEFAULT]
TOKEN = ${DISCORD_TOKEN:-}
RPING = ${RPING:-}
REGPING = ${REGPING:-}
STARCH = ${STARCH:-}
CLOG = ${CLOG:-}
SPAWNLOG = ${SPAWNLOG:-}

[CONFIRMS]
RPINGCONFIRM = ${RPINGCONFIRM:-N}
REGPINGCONFIRM = ${REGPINGCONFIRM:-N}
STARCHCONFIRM = ${STARCHCONFIRM:-N}
CLOGCONFIRM = ${CLOGCONFIRM:-N}
SPAWNLOGCONFIRM = ${SPAWNLOGCONFIRM:-N}
EOF
  echo "Created config.ini from environment variables."
fi

# If there is a venv, activate it (optional)
if [ -d "venv" ]; then
  . venv/bin/activate
fi

# Start the bot
python main.py
