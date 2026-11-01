#!/usr/bin/env bash
# start.sh - One-Click Launcher for Play-McNopoly (Linux & macOS)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================="
echo "🎩 Launching Play-McNopoly (Port 8085)"
echo "======================================================="

# 1. Environment Configuration
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "Creating default .env from .env.example..."
    cp .env.example .env
fi

# 2. Virtual Environment Setup
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
fi
./venv/bin/pip install -q -r requirements.txt

PYTHON="./venv/bin/python"

# 3. Database Migrations & 40-Space Board Seeding
$PYTHON manage.py migrate --noinput
$PYTHON manage.py seed_board

# 4. Launch Web Dashboard
echo "Starting Play-McNopoly server at http://localhost:8085/"
echo "Mobile AMOLED View: http://localhost:8085/mobile/"
$PYTHON manage.py runserver 0.0.0.0:8085
