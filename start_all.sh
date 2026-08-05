#!/bin/bash

# Dieses Skript startet alle Docker-Projekte auf dem NAS

# Basis-Verzeichnis ermitteln (das Verzeichnis, in dem dieses Skript liegt)
BASE_DIR=$(cd "$(dirname "$0")" && pwd)

echo "====================================="
echo "Starte Startseite_projekt..."
cd "$BASE_DIR/startseite_projekt" && docker-compose up -d --build

echo "====================================="
echo "Starte NASFILE..."
cd "$BASE_DIR/NASFILE" && docker-compose up -d --build

echo "====================================="
echo "Starte projektmitmarv..."
cd "$BASE_DIR/projektmitmarv" && docker-compose up -d --build

echo "====================================="
echo "Starte Historisches-Archiv..."
cd "$BASE_DIR/Historisches-Archiv" && docker-compose up -d --build

echo "====================================="
echo "Alle Docker-Container wurden gestartet!"
echo "Du kannst die Stati mit 'docker ps' überprüfen."
