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

// Authentication & Authorization Middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Nicht autorisiert. Bitte einloggen.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Ungültiges oder abgelaufenes Token.' });
        req.user = user;
        next();
    });
};

// Check if user has one of the allowed roles
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        authenticateToken(req, res, () => {
            if (!req.user || !allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Zugriff verweigert. Unzureichende Rechte.' });
            }
            next();
        });
    };
};

// API: Auth status check
app.get('/api/auth/me', (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) return res.json({ loggedIn: false });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.json({ loggedIn: false });
        res.json({ loggedIn: true, username: user.username, role: user.role });
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

        // Check if Gast
        if (user.role === 'Gast') {
            return res.status(403).json({ error: 'Zugang verweigert. Bitte Administrator für Rechtezuweisung kontaktieren.' });
        }

        // Generate Token including role
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Set secure HttpOnly cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: false, // Set to true if using HTTPS in production
            maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        res.json({ success: true, username: user.username, role: user.role });
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

// ==========================================
// PROJECTS API (RBAC Secured)
// ==========================================

// GET (Read): Allowed for Admin, Mitarbeiter, Benutzer
app.get('/api/projects', requireRole(['Admin', 'Mitarbeiter', 'Benutzer']), async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM projects");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Projekte konnten nicht geladen werden.' });
    }
});

// POST (Write): Allowed for Admin, Mitarbeiter
app.post('/api/projects', requireRole(['Admin', 'Mitarbeiter']), async (req, res) => {
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

// DELETE (Delete): Allowed for Admin only
app.delete('/api/projects/:id', requireRole(['Admin']), async (req, res) => {
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

// ==========================================
// USER MANAGEMENT API (Admin only)
// ==========================================

// GET all users
app.get('/api/admin/users', requireRole(['Admin']), async (req, res) => {
    try {
        const result = await db.query("SELECT id, username, role FROM users ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Benutzerliste konnte nicht abgerufen werden.' });
    }
});

// POST create a user
app.post('/api/admin/users', requireRole(['Admin']), async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Benutzername, Passwort und Rolle sind erforderlich.' });
    }

    const validRoles = ['Admin', 'Mitarbeiter', 'Benutzer', 'Gast'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Ungültige Rolle.' });
    }

    try {
        // Check if exists
        const check = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Benutzername existiert bereits.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        await db.query(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
            [username, hash, role]
        );
        res.status(201).json({ success: true, message: 'Benutzer erfolgreich angelegt.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Benutzer konnte nicht angelegt werden.' });
    }
});

// PUT update user's role
app.put('/api/admin/users/:id/role', requireRole(['Admin']), async (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;

    const validRoles = ['Admin', 'Mitarbeiter', 'Benutzer', 'Gast'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Ungültige Rolle.' });
    }

    try {
        const check = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
        }

        // Prevent self-demoting from admin just to be safe
        if (check.rows[0].username === req.user.username && role !== 'Admin') {
            return res.status(400).json({ error: 'Sie können Ihre eigene Admin-Rolle nicht ändern.' });
        }

        await db.query("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);
        res.json({ success: true, message: 'Benutzerrolle erfolgreich aktualisiert.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Rolle konnte nicht geändert werden.' });
    }
});

// DELETE a user
app.delete('/api/admin/users/:id', requireRole(['Admin']), async (req, res) => {
    const userId = req.params.id;
    try {
        const check = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
        }

        // Prevent self-deletion
        if (check.rows[0].username === req.user.username) {
            return res.status(400).json({ error: 'Sie können Ihren eigenen Account nicht löschen.' });
        }

        await db.query("DELETE FROM users WHERE id = $1", [userId]);
        res.json({ success: true, message: 'Benutzer erfolgreich gelöscht.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Benutzer konnte nicht gelöscht werden.' });
    }
});

// Fallback to route any other request to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database and start server
db.initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server läuft auf Port ${PORT}`);
        console.log(`Web-Portal erreichbar unter: http://localhost:${PORT}`);
    });
});
