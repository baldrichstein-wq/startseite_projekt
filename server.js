const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8089;
const JWT_SECRET = process.env.JWT_SECRET || 'projekt-woche-secret-key-12345';

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Nicht autorisiert. Bitte einloggen.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Ungültiges oder abgelaufenes Token.' });
        req.user = user;
        next();
    });
};

// API: Auth status check
app.get('/api/auth/me', (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) return res.json({ loggedIn: false });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.json({ loggedIn: false });
        res.json({ loggedIn: true, username: user.username });
    });
});

// API: Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Bitte Benutzername und Passwort angeben.' });
    }

    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = result.rows[0];
        
        if (!user) {
            return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort.' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort.' });
        }

        // Generate Token
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });

        // Set secure HttpOnly cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: false, // Set to true if using HTTPS in production
            maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        res.json({ success: true, username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfehler beim Login.' });
    }
});

// API: Logout
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
});

// API: Get all projects
app.get('/api/projects', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM projects");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Projekte konnten nicht geladen werden.' });
    }
});

// API: Add a project (Authenticated only)
app.post('/api/projects', authenticateToken, async (req, res) => {
    const { name, url, description, category, icon } = req.body;
    if (!name || !url) {
        return res.status(400).json({ error: 'Name und URL sind Pflichtfelder.' });
    }

    const id = 'project-' + Date.now();
    try {
        await db.query(
            "INSERT INTO projects (id, name, url, description, category, icon, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [id, name, url, description || '', category || 'Allgemein', icon || 'bi-link-45deg', 'checking']
        );
        
        const result = await db.query("SELECT * FROM projects WHERE id = $1", [id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Projekt konnte nicht hinzugefügt werden.' });
    }
});

// API: Delete a project (Authenticated only)
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
    const projectId = req.params.id;
    try {
        const result = await db.query("SELECT * FROM projects WHERE id = $1", [projectId]);
        const project = result.rows[0];
        
        if (!project) {
            return res.status(404).json({ error: 'Projekt nicht gefunden.' });
        }

        await db.query("DELETE FROM projects WHERE id = $1", [projectId]);
        res.json({ success: true, message: 'Projekt erfolgreich gelöscht.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Projekt konnte nicht gelöscht werden.' });
    }
});

// Fallback to route any other request to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database and then start listening
db.initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server läuft auf Port ${PORT}`);
        console.log(`Web-Portal erreichbar unter: http://localhost:${PORT}`);
    });
});
