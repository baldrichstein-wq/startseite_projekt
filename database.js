const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(connectionString ? { connectionString } : {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'portal'
});

const initDb = async () => {
    let retries = 10;
    while (retries > 0) {
        try {
            await pool.query('SELECT 1');
            break;
        } catch (err) {
            retries -= 1;
            console.log(`Database not ready yet. Retrying in 2 seconds... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    try {
        // Create Projects Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                url VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100),
                icon VARCHAR(100),
                status VARCHAR(20) DEFAULT 'checking'
            );
        `);

        // Seed Default Projects from projects.json
        const projectCountRes = await pool.query("SELECT COUNT(*) as count FROM projects");
        const projectCount = parseInt(projectCountRes.rows[0].count, 10);

        if (projectCount === 0) {
            const projectsJsonPath = path.join(__dirname, 'projects.json');
            if (fs.existsSync(projectsJsonPath)) {
                const defaultProjects = JSON.parse(fs.readFileSync(projectsJsonPath, 'utf8'));
                for (const proj of defaultProjects) {
                    await pool.query(
                        "INSERT INTO projects (id, name, url, description, category, icon, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                        [proj.id, proj.name, proj.url, proj.description, proj.category, proj.icon, proj.status || 'checking']
                    );
                }
                console.log("Default projects seeded in PostgreSQL from projects.json");
            }
        }
    } catch (err) {
        console.error("Database initialization failed:", err.message);
    }
};

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    initDb
};
