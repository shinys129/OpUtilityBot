#!/bin/sh
set -e

# Ensure we run from the folder that contains main.py
cd "$(dirname "$0")"

# If no config.ini present, create it from environment variables so service is non-interactive
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

# Activate venv if present (optional)
if [ -d "venv" ]; then
  . venv/bin/activate
fi

# Run the bot
python main.py
