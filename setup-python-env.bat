@echo off
title Python Environment Setup

echo ============================================
echo Creating Python Virtual Environment...
echo ============================================

python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Python is not installed or is not added to PATH.
    echo Please install Python first:
    echo https://www.python.org/downloads/
    pause
    exit /b
)

if not exist ".venv" (
    python -m venv .venv
)

echo.
echo Activating virtual environment...

call .venv\Scripts\activate.bat

echo.
echo Installing required packages...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo.
echo ============================================
echo Setup Complete!
echo ============================================
echo You may now run the project.
pause