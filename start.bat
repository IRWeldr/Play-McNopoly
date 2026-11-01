@echo off
REM start.bat - One-Click Launcher for Play-McNopoly (Windows)
cd /d "%~dp0"

echo =======================================================
echo 🎩 Launching Play-McNopoly (Port 8085)
echo =======================================================

IF NOT EXIST ".env" (
    IF EXIST ".env.example" (
        echo Creating default .env from .env.example...
        copy .env.example .env >nul
    )
)

IF NOT EXIST "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install --upgrade pip
) ELSE (
    call venv\Scripts\activate.bat
)
pip install -q -r requirements.txt

python manage.py migrate --noinput
python manage.py seed_board
echo Starting Play-McNopoly server at http://localhost:8085/
python manage.py runserver 0.0.0.0:8085
pause
