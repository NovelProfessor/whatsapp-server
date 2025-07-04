import sqlite3 from 'sqlite3';
import {open} from 'sqlite';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// create data folder if it doesn't exist
const dataPath = `${__dirname}/data`;

try {
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath);
        console.log(`Folder '${dataPath}' created successfully.`);
    } else {
        console.log(`Folder '${dataPath}' already exists.`);
    }

} catch (err) {
    console.log('Error creating data folder:', err);
    process.exit(1);
}

const db = await open({
    filename: './data/mydata.db',
    driver: sqlite3.Database
});
console.log(`connected to database.`)

let sql = `CREATE TABLE IF NOT EXISTS users (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    pushname TEXT NOT NULL,
    user TEXT NOT NULL,
    platform TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

await db.exec(sql);
console.log(`users table created.`);


sql = `CREATE TABLE IF NOT EXISTS chats (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    message TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    sender_name TEXT NOT NULL,
    chat_type TEXT NOT NULL,
    device_type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

await db.exec(sql);
console.log(`chats table created.`);


sql = `CREATE TABLE IF NOT EXISTS messages (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    message TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    sender_name TEXT NOT NULL,
    chat_type TEXT NOT NULL,
    device_type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

await db.exec(sql);
console.log(`messages table created.`);

export {db};