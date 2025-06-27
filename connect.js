const sqlite3 = require('sqlite3');
const sql3 = sqlite3.verbose();

const connected = (err) => {
    if(err){
        console.log(err.message);
        return;
    }
    console.log('Connected to the database.');

}

const DB = new sql3.Database('./mydata.db', sqlite3.OPEN_READWRITE, connected);



let sql = `CREATE TABLE IF NOT EXISTS users (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    pushname TEXT NOT NULL,
    user TEXT NOT NULL,
    platform TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

DB.run(sql, [], (err)=>{
    if(err){
        console.log(err.message);
        return;
    }
    console.log('Users table created successfully');
});


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

DB.run(sql, [], (err) => {
    if(err){
        console.log(err.message);
        return;
    }
    console.log('Chats table created successfully');
});


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

DB.run(sql, [], (err) => {
    if(err){
        console.log(err.message);
        return;
    }
    console.log('Messages table created successfully');
});

module.exports = DB;