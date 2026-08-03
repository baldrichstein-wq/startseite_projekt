# 🪐 Projekt-Hub — Zentrales NAS-Portal

Willkommen beim **Projekt-Hub**, der zentralen Landingpage zur Navigation und Verwaltung aller Webanwendungen Ihrer Projektwoche. 

Diese Webanwendung wurde als moderne, performante Full-Stack-Lösung entwickelt, die auf einem **Node.js/Express-Backend**, einer **PostgreSQL-Datenbank** und einem responsiven **Vanilla HTML/CSS/JS-Frontend** basiert.

---

## 🌟 Features

* **Premium UI/UX:** Dunkles Sci-Fi-Theme mit Glassmorphismus-Effekten, schwebenden, animierten Hintergrund-Neon-Sphären und sanften Hover-Übergängen.
* **Echtzeit-Suche & Filter:** Blitzschnelles Filtern der Projektkärtchen nach Namen, Beschreibungen oder Kategorien ("Entwicklung", "Infrastruktur", "Produktivität").
* **Live-Statusprüfung (Ping):** Das Portal prüft im Hintergrund automatisch die Erreichbarkeit jeder verlinkten Anwendung und zeigt den aktuellen Status ("Online" / "Offline") visuell an.
* **Admin-Authentifizierung:** Ein gesichertes Login-Modal schützt administrative Funktionen (Hinzufügen und Löschen von Projekten) mittels **JSON Web Tokens (JWT)**, die in sicheren HttpOnly-Cookies gespeichert werden.
* **PostgreSQL-Anbindung:** Persistente Speicherung aller verlinkten Projekte in einer relationalen Datenbank.
* **Auto-Seeding:** Beim ersten Start initialisiert das Backend automatisch das Datenbankschema, legt einen Standard-Admin-Account an und lädt die Standard-Projekte aus der `projects.json`.

---

## 📂 Projektstruktur

```
startseite_projekt/
├── Dockerfile              # Docker-Image-Definition für die Node-Anwendung
├── docker-compose.yml      # Verbund-Setup für Web-App und PostgreSQL-Datenbank
├── package.json            # Node-Abhängigkeiten (express, pg, jsonwebtoken, bcryptjs, etc.)
├── database.js             # PostgreSQL-Verbindungspool, Schemadefinition & Seeding
├── server.js               # Express-Server mit Authentifizierungs- & API-Routen
├── index.html              # Hauptseite mit Login- und Projekt-Modals
├── style.css               # Design System, Layouts & Keyframe-Animationen
├── app.js                  # Frontend-Logik (API-Abrufe, Suche, Filter & Status-Ping)
├── projects.json           # Standard-Konfiguration der Projekte zum Seed-Zeitpunkt
└── README.md               # Diese Dokumentation
```

---

## 🚀 Installation & Inbetriebnahme

Es gibt zwei Wege, um den Projekt-Hub zu betreiben: über **Docker Compose** (empfohlen für NAS-Systeme) oder **manuell/lokal**.

### Option A: Mit Docker Compose (Empfohlen)

Stellen Sie sicher, dass Docker und Docker Compose auf Ihrem System installiert sind.

1. **Docker-Verbund starten:**
   ```bash
   docker-compose up --build
   ```
   *Dieser Befehl lädt das PostgreSQL-Image herunter, baut das Web-Image und verbindet beide Container über ein internes Docker-Netzwerk.*

2. **Portal aufrufen:**
   Öffnen Sie Ihren Browser unter **`http://localhost:8089`**.

### Option B: Manuelle lokale Installation

Dazu benötigen Sie eine installierte PostgreSQL-Datenbank auf Ihrem System.

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

2. **Umgebungsvariablen konfigurieren:**
   Setzen Sie die Verbindungsdaten für Ihre PostgreSQL-Datenbank in Ihrer Shell (oder erstellen Sie eine `.env`-Datei):
   ```bash
   export PGHOST="localhost"
   export PGPORT=5432
   export PGUSER="IhrDatenbankNutzer"
   export PGPASSWORD="IhrPasswort"
   export PGDATABASE="portal"
   ```

3. **Server starten:**
   ```bash
   npm start
   ```
   Das Portal ist unter **`http://localhost:8089`** erreichbar.

---

## 🔑 Standard-Zugangsdaten

Nach der ersten Datenbank-Initialisierung können Sie sich mit folgendem Benutzer anmelden, um Projekte zu bearbeiten:
* **Benutzername:** `admin`
* **Passwort:** `admin1234`

---

## 🌐 Bereitstellung über einen NAS & Dynamic DNS (Reverse Proxy)

Um dieses Portal und die dahinterliegenden Projekte (wie das *Historische Archiv* und das *Rezeptbuch*) im Internet über eine einzige DDNS-Adresse (z. B. `mein-nas.dyndns.org`) freizugeben, empfiehlt sich folgende Konfiguration:

### 1. Portweiterleitung im Router
Leiten Sie die Ports **80 (HTTP)** und **443 (HTTPS)** Ihres Routers an die IP-Adresse Ihres NAS weiter.

### 2. Reverse Proxy einrichten (z. B. Nginx Proxy Manager oder Synology Reverse Proxy)
Erstellen Sie Routing-Regeln für die Subdomains oder Unterpfade:

* **Haupt-Portal (`mein-nas.dyndns.org`):**
  * Leitet weiter an $\rightarrow$ IP-Adresse Ihres NAS auf Port **`8089`** (unser Portal).
* **Historisches Archiv (`mein-nas.dyndns.org/archiv`):**
  * Leitet weiter an $\rightarrow$ IP-Adresse Ihres NAS auf Port **`8080`**.
* **Rezeptbuch / projektmitmarv (`mein-nas.dyndns.org/projektmitmarv`):**
  * Leitet weiter an $\rightarrow$ IP-Adresse des Rezeptbuch-Containers auf dessen Web-Port.

*Dadurch sind alle Anwendungen unter einer einzigen Domain erreichbar, und das Portal verlinkt sie nahtlos über relative Pfade!*
