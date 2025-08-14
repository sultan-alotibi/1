const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Create a new database file or open an existing one
const db = new sqlite3.Database('./db.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        // User table for admins
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error("Error creating users table", err.message);
            } else {
                // Check if admin user exists, if not, create one
                db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                    if (err) {
                        return console.error("Could not count users", err.message);
                    }
                    if (row.count === 0) {
                        const defaultEmail = 'admin@example.com';
                        const defaultPassword = 'password';
                        bcrypt.hash(defaultPassword, saltRounds, (err, hash) => {
                            if (err) {
                                return console.error("Could not hash password", err.message);
                            }
                            db.run('INSERT INTO users (email, password) VALUES (?, ?)', [defaultEmail, hash], (err) => {
                                if (err) {
                                    return console.error("Could not insert default admin", err.message);
                                }
                                console.log('********************************');
                                console.log('Default admin user created.');
                                console.log(`Email: ${defaultEmail}`);
                                console.log(`Password: ${defaultPassword}`);
                                console.log('********************************');
                            });
                        });
                    }
                });
            }
        });

        // Credentials table for imported data
        db.run(`CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            value TEXT NOT NULL,
            password TEXT NOT NULL,
            type TEXT NOT NULL,
            source_file TEXT,
            UNIQUE(value, password)
        )`, (err) => {
            if (err) {
                console.error("Error creating credentials table", err.message);
            } else {
                console.log("Credentials table created or already exists.");
            }
        });

        // Settings table
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`, (err) => {
            if (err) {
                console.error("Error creating settings table", err.message);
            } else {
                console.log("Settings table created or already exists.");
            }
        });
    });
}

module.exports = db;
