#!/bin/bash

# Dieses Skript stoppt alle Docker-Projekte auf dem NAS

BASE_DIR=$(cd "$(dirname "$0")" && pwd)

echo "====================================="
echo "Stoppe Startseite_projekt..."
cd "$BASE_DIR/startseite_projekt" && docker-compose down

echo "====================================="
echo "Stoppe NASFILE..."
cd "$BASE_DIR/NASFILE" && docker-compose down

echo "====================================="
echo "Stoppe projektmitmarv..."
cd "$BASE_DIR/projektmitmarv" && docker-compose down

echo "====================================="
echo "Stoppe Historisches-Archiv..."
cd "$BASE_DIR/Historisches-Archiv" && docker-compose down

echo "====================================="
echo "Alle Docker-Container wurden gestoppt!"
