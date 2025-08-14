const fs = require('fs');
const readline = require('readline');
const db = require('./database');

const BATCH_SIZE = 1000;

function processFile(filePath, dataType, separator) {
    return new Promise((resolve, reject) => {
        const stats = {
            totalRows: 0,
            importedCount: 0,
            skippedCount: 0
        };

        let batch = [];

        const stream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity
        });

        const insertStatement = db.prepare(
            'INSERT OR IGNORE INTO credentials (value, password, type, source_file) VALUES (?, ?, ?, ?)'
        );

        const insertBatch = () => {
            if (batch.length === 0) return;

            const transaction = db.transaction((items) => {
                for (const item of items) {
                    const result = insertStatement.run(item.value, item.password, item.type, item.source_file);
                    if (result.changes > 0) {
                        stats.importedCount++;
                    } else {
                        stats.skippedCount++;
                    }
                }
            });

            transaction(batch);
            batch = []; // Clear the batch
        };

        db.serialize(() => {
            rl.on('line', (line) => {
                stats.totalRows++;
                const parts = line.split(separator);
                if (parts.length >= 2) {
                    const value = parts[0].trim();
                    const password = parts.slice(1).join(separator).trim();

                    if (value && password) {
                        batch.push({
                            value: value,
                            password: password,
                            type: dataType,
                            source_file: filePath // Using the temp path as source for now
                        });

                        if (batch.length >= BATCH_SIZE) {
                            insertBatch();
                        }
                    }
                }
            });

            rl.on('close', () => {
                // Insert any remaining items in the last batch
                if (batch.length > 0) {
                    insertBatch();
                }
                // Finalize the statement
                insertStatement.finalize();
                resolve(stats);
            });

            rl.on('error', (err) => {
                insertStatement.finalize();
                reject(err);
            });
        });
    });
}

module.exports = { processFile };
