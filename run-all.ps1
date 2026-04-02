#!/usr/bin/env pwsh
# run-all.ps1 - create venv, install deps, start backend and frontend
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

function Test-PortOpen($port) {
    try {
        $res = Test-NetConnection -ComputerName '127.0.0.1' -Port $port -WarningAction SilentlyContinue
        return $res.TcpTestSucceeded
    } catch { return $false }
}

if (-not (Test-Path ".venv")) {
    Write-Output "Creating virtualenv..."
    py -3 -m venv .venv
}

$python = Join-Path .venv 'Scripts\python.exe'
if (-not (Test-Path $python)) {
    Write-Output "Python in .venv not found; ensure 'py' is installed and try again."
} else {
    Write-Output "Installing Python requirements..."
    & $python -m pip install -r requirements.txt
}

# Start backend if not running
if (Test-PortOpen 8000) {
    Write-Output "Backend already running on port 8000"
} else {
    if (Test-Path $python) {
        Write-Output "Starting backend..."
        Start-Process -FilePath $python -ArgumentList "-m", "uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000", "--reload" -WorkingDirectory $root
    } else {
        Write-Output "Cannot start backend: python not available."
    }
}

# Start frontend if not running
if (Test-PortOpen 8080) {
    Write-Output "Frontend already running on port 8080"
} else {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Output "Starting frontend..."
        Start-Process -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory $root
    } else {
        Write-Output "npm not found; please install Node.js"
    }
}

Write-Output "Services started (if not already running)."
Write-Output "Backend: http://localhost:8000  Frontend: http://localhost:8080"
