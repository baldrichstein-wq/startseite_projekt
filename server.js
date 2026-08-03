const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8089;

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ==========================================
// PROJECTS API (Public – no auth required)
// ==========================================

// GET all projects (everyone can read)
app.get('/api/projects', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM projects");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Projekte konnten nicht geladen werden.' });
    }
});

// Fallback: serve index.html for all other routes
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
