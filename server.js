const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database');
const { Writable } = require('stream');
const session = require('express-session');
const bcrypt = require('bcrypt');

// --- Session Configuration ---
const app = express();
app.use(session({
    secret: 'a-very-strong-and-secret-key-for-sessions', // In a real app, use an env variable
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// --- Multer Configuration ---
// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

const port = process.env.PORT || 3000;

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up public directory for static files
app.use(express.static(path.join(__dirname, 'public')));

// Set up body-parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basic home route
app.get('/', (req, res) => {
    // We will add stats here later
    db.get("SELECT value FROM settings WHERE key = 'siteTitle'", (err, row) => {
        const siteTitle = row ? row.value : 'Database Manager';
        res.render('index', { title: 'Home', siteTitle: siteTitle });
    });
});

app.get('/search', (req, res) => {
    const searchTerm = req.query.term || '';
    const resultsLimit = 100;

    db.get("SELECT value FROM settings WHERE key = 'publicSearchEnabled'", (err, setting) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error checking settings.");
        }

        const isEnabled = setting ? setting.value === 'on' : false;
        if (!isEnabled) {
            return res.status(403).render('search_disabled', { title: 'Search Disabled' });
        }

        if (!searchTerm) {
            return res.render('search', { title: 'Search', results: [], searchTerm: '' });
        }

        const query = `SELECT * FROM credentials WHERE value LIKE ? LIMIT ${resultsLimit}`;
        db.all(query, [`%${searchTerm}%`], (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error performing search.");
            }
            res.render('search', { title: `Search Results for "${searchTerm}"`, results: rows, searchTerm: searchTerm });
        });
    });
});


// --- Auth Middleware ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/admin/login');
};

// --- Auth Routes ---
app.get('/admin/login', (req, res) => {
    res.render('admin/login', { title: 'Admin Login', error: null });
});

app.post('/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render('admin/login', { title: 'Admin Login', error: 'Please provide email and password.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error(err);
            return res.render('admin/login', { title: 'Admin Login', error: 'An error occurred.' });
        }
        if (!user) {
            return res.render('admin/login', { title: 'Admin Login', error: 'Invalid credentials.' });
        }

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                req.session.user = user;
                res.redirect('/admin/dashboard');
            } else {
                res.render('admin/login', { title: 'Admin Login', error: 'Invalid credentials.' });
            }
        });
    });
});

app.post('/admin/credentials/:id/delete', isAuthenticated, (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM credentials WHERE id = ?", [id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send("Failed to delete credential.");
        }
        // Redirect back to the credentials page.
        // req.get('Referer') is used to redirect back to the same page the user was on, preserving the page number.
        res.redirect(req.get('Referer') || '/admin/credentials');
    });
});

app.get('/admin/settings', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM settings", (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error fetching settings.");
        }
        const settings = rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});
        res.render('admin/settings', { title: 'Settings', settings });
    });
});

app.post('/admin/settings', isAuthenticated, (req, res) => {
    const settings = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    for (const key in settings) {
        stmt.run(key, settings[key]);
    }
    stmt.finalize();
    res.redirect('/admin/settings');
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
});


// --- Admin Routes (Protected) ---
app.get('/admin/dashboard', isAuthenticated, (req, res) => {
    const queries = [
        new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM credentials", (err, row) => {
                if (err) reject(err);
                else resolve({ total: row.count });
            });
        }),
        new Promise((resolve, reject) => {
            db.get("SELECT COUNT(DISTINCT value) as count FROM credentials", (err, row) => {
                if (err) reject(err);
                else resolve({ unique: row.count });
            });
        }),
        new Promise((resolve, reject) => {
            db.all("SELECT type, COUNT(*) as count FROM credentials GROUP BY type", (err, rows) => {
                if (err) reject(err);
                else {
                    const typeCounts = rows.reduce((acc, row) => {
                        acc[row.type] = row.count;
                        return acc;
                    }, {});
                    resolve({ typeCounts });
                }
            });
        })
    ];

    Promise.all(queries)
        .then(results => {
            const stats = results.reduce((acc, current) => ({ ...acc, ...current }), {});
            res.render('admin/dashboard', {
                title: 'Dashboard',
                user: req.session.user,
                stats: stats
            });
        })
        .catch(err => {
            console.error("Error fetching dashboard stats:", err);
            res.status(500).send("Error fetching dashboard stats.");
        });
});

app.get('/admin/import', isAuthenticated, (req, res) => {
    res.render('admin/import', { title: 'Import Data', stats: null });
});

app.get('/admin/credentials', isAuthenticated, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 50; // Records per page
    const offset = (page - 1) * limit;

    const countQuery = "SELECT COUNT(*) as count FROM credentials";
    const dataQuery = `SELECT * FROM credentials ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;

    db.get(countQuery, (err, countRow) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error fetching data.");
        }
        db.all(dataQuery, (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error fetching data.");
            }

            const totalRecords = countRow.count;
            const totalPages = Math.ceil(totalRecords / limit);

            res.render('admin/credentials', {
                title: 'Manage Credentials',
                credentials: rows,
                currentPage: page,
                totalPages: totalPages
            });
        });
    });
});

const { processFile } = require('./importer');

app.post('/admin/import', upload.single('dataFile'), async (req, res) => {
    // Basic validation
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { dataType, separator } = req.body;
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    try {
        const stats = await processFile(filePath, dataType, separator);

        const message = `اكتمل استيراد الملف ${originalName}.<br>
                         إجمالي الأسطر: ${stats.totalRows}.<br>
                         سجلات جديدة تمت إضافتها: ${stats.importedCount}.<br>
                         سجلات مكررة تم تجاهلها: ${stats.skippedCount}.`;

        res.render('admin/import', {
            title: 'Import Complete',
            stats: { message: message }
        });

    } catch (error) {
        console.error('Import failed:', error);
        res.status(500).send('An error occurred during the import process.');
    } finally {
        // Delete the file after processing
        fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
