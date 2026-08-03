const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Connection Pool Configuration
// Uses DATABASE_URL environment variable if present, or individual connection parameters
const connectionString = process.env.DATABASE_URL;

const pool = new Pool(connectionString ? { connectionString } : {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'portal'
});

// Database initialization wrapper
const initDb = async () => {
    try {
        // 1. Create Users Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL
            );
        `);

        // 2. Create Projects Table
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

        // 3. Seed Default Admin User
        const userCountRes = await pool.query("SELECT COUNT(*) as count FROM users");
        const userCount = parseInt(userCountRes.rows[0].count, 10);
        
        if (userCount === 0) {
            const defaultUser = 'admin';
            const defaultPassword = 'admin1234';
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(defaultPassword, salt);

            await pool.query(
                "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
                [defaultUser, hash]
            );
            console.log(`Default admin user seeded in PostgreSQL: ${defaultUser} / ${defaultPassword}`);
        }

        // 4. Seed Default Projects
        const projectCountRes = await pool.query("SELECT COUNT(*) as count FROM projects");
        const projectCount = parseInt(projectCountRes.rows[0].count, 10);

        if (projectCount === 0) {
            const projectsJsonPath = path.join(__dirname, 'projects.json');
            if (fs.existsSync(projectsJsonPath)) {
                try {
                    const defaultProjects = JSON.parse(fs.readFileSync(projectsJsonPath, 'utf8'));
                    for (const proj of defaultProjects) {
                        await pool.query(
                            "INSERT INTO projects (id, name, url, description, category, icon, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                            [proj.id, proj.name, proj.url, proj.description, proj.category, proj.icon, proj.status || 'checking']
                        );
                    }
                    console.log("Default projects seeded in PostgreSQL from projects.json");
                } catch (jsonErr) {
                    console.error("Error seeding default projects:", jsonErr.message);
                }
            }
        }
    } catch (err) {
        console.error("Database initialization failed:", err.message);
    }
};

// Export Pool and query helpers
module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    initDb
};
