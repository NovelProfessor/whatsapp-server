import os from 'os';
import {sg} from './singleton.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import Whatsapp from 'whatsapp-web.js'
const { Client, LocalAuth, MessageMedia } = Whatsapp

import qrcode from 'qrcode-terminal';
import express from 'express';
const app = express();
const port = process.env.PORT || 80;
import fileUpload from 'express-fileupload';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

// FFMPEG library is used to convert WhatsApp audio and video to a format that is compatible with old Nokia phones

import ffmpeg1 from '@ffmpeg-installer/ffmpeg';
const ffmpegPath = ffmpeg1.path;

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
ffmpeg.setFfmpegPath(ffmpegPath);


// Use the express-fileupload middleware
app.use(fileUpload());

import {db} from './connect.js';


// create media folder if it doesn't exist
const mediaPath = `${__dirname}/media`;

try {

    if (!fs.existsSync(mediaPath)) {
        fs.mkdirSync(mediaPath);
        console.log(`Folder '${mediaPath}' created successfully.`);
    } else {
        console.log(`Folder '${mediaPath}' already exists.`);
    }

} catch (err) {
    console.log('Error creating media folder:', err);
    process.exit(1);
}

// start the express web server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

const sockserver = new WebSocketServer({ port: 443 });

app.use(express.json());


// The below endpoint is only used by my website to allow users to download my WhatsApp application
// It is not used by the J2ME WhatsApp client

app.get('/download/:filename', function(req, res){
    const file = `${__dirname}/${req.params.filename}`;
    res.download(file); // Set disposition and send it.
});

// The below endpoint is serving the login.html page which generates the QR code on the website
// which needs to be scanned by a running instance of WhatsApp client on iPhone or Android

app.use('/login', (req, res) => {
    res.sendFile('/login.html', { root: __dirname });
});


// The below endpoint is called by the J2ME WhatsApp client to list the Chats in the chats screen
// The string ';interface=wifi' gets added to the URL just to force BlackBerry (OS 6 and 7) devices to use WiFi

app.get('/api/chats/:receiver', async (req, res) => {

    var pageSize = 30, page = 0;
    const regex = /;interface=wifi/i;
        
    if(req.query.page_size !== undefined && req.query.page_size !== ''){
        pageSize = req.query.page_size;
        pageSize = pageSize.replace(regex, "");
    }

    if(req.query.page !== undefined && req.query.page !== ''){
        page = req.query.page;
        page = page.replace(regex, "");
    }  

    try {

        var receiver = req.params.receiver;
        receiver = receiver.replace(regex, "");

        const client = sg.getSocketById(receiver.replace("@c.us","")); //receiver is mobile number
        if(client == undefined)
            return res.status(401).json({error: "User session not found"});

        const rows = await db.all(`SELECT * from chats WHERE receiver = ? ORDER BY timestamp DESC LIMIT 20`, [receiver]);
        let chats = rows.map((row) => ({
                _id: row._id,
                sender: row.sender,
                senderName: row.sender_name,
                message: row.message,
                status: row.status,
                createdAt: row.timestamp,
                updatedAt: row.timestamp
            }));

        res.status(200).json({chats: chats});


    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/contacts/:user', async(req, res) => {

    try {
        var mobileNumber = req.params.user;
        const regex = /;interface=wifi/i;
        mobileNumber = mobileNumber.replace(regex, "");

        const client = sg.getSocketById(mobileNumber.replace("@c.us","")); //user is mobile number
        if(client == undefined)
            return res.status(401).json({error: "User session not found"});

        var contacts = await client.getContacts();

        var filteredContacts =  contacts.filter(item => {
            return item.isWAContact == true && item.id.server != "lid" && item.isBusiness != true;
        });

        const compactContactsList = filteredContacts.map(item => {
            const container = {};

            container.id = item.id._serialized;

            if(item.name !== undefined)
                container.name = item.name;

            else if(item.pushname !== undefined)
                container.name = item.pushname;

            else
                container.name = item.id.user;

            return container;
        })

        res.status(200).json({contacts: compactContactsList});

    } catch (error){
        console.log(error);
        res.status(500).json({error: error.message});
    }

});

// The below endpoint is called by the J2ME WhatsApp client to login to the app
// :user is a path variable which will contain the mobile number of the user who is logging in
// The string ';interface=wifi' gets added to the URL just to force BlackBerry (OS 6 and 7) devices to use WiFi

app.get('/api/login/:user', async (req, res) => {

    try {
        var mobileNumber = req.params.user;
        const regex = /;interface=wifi/i;
        mobileNumber = mobileNumber.replace(regex, "");

        console.log(`login user = ${mobileNumber}`);

        const client = sg.getSocketById(mobileNumber); //user is mobile number
        if(client == undefined)
            return res.status(401).json({error: "User session not found"});

        const user = {
            pushname: client.info.pushname, 
            user: client.info.wid.user, 
            platform: client.info.platform
        };

        return res.status(200).json(user);

    } catch (error){
        console.log(error);
        res.status(500).json({error: error.message});
    }

});

// The below endpoint is called by the J2ME WhatsApp client to fetch all the messages received by the logged in user from the selected sender
// :receiver is the mobile number of the logged in user
// :sender is the mobile number of the person who sent you the messages
// The string ';interface=wifi' gets added to the URL just to force BlackBerry (OS 6 and 7) devices to use WiFi

app.get('/api/messages/:receiver/:sender', async (req, res) => {

    var pageSize = 30, page = 0;
        
    const regex = /;interface=wifi/i;
        
    if(req.query.page_size !== undefined && req.query.page_size !== ''){
        pageSize = req.query.page_size;
        pageSize = pageSize.replace(regex, "");
    }

    if(req.query.page !== undefined && req.query.page !== ''){
        page = req.query.page;
        page = page.replace(regex, "");
    }  

    try {

        var receiver = req.params.receiver;
        
        var sender = req.params.sender;
        sender = sender.replace(regex, "");


        const client = sg.getSocketById(receiver.replace("@c.us","")); //receiver is mobile number
        if(client == undefined)
            return res.status(401).json({error: "User session not found"});

        let sql = `SELECT * FROM messages where receiver in (?,?) and sender in (?,?) ORDER BY timestamp DESC LIMIT 20`;
        const rows = await db.all(sql, [receiver, sender, sender, receiver]);
        let messages = rows.map(row => (
                {
                    _id: row._id,
                    sender: row.sender,
                    receiver: row.receiver,
                    message: row.message,
                    status: row.status,
                    senderName: row.sender_name,
                    chatType: row.chat_type,
                    deviceType: row.device_type,
                    createdAt: row.timestamp,
                    updatedAt: row.timestamp
                }
            ));

        res.status(200).json({ messages: messages });



    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});





app.post(['/api/messages','/api/messages/:id'], async (req, res) => {
    try {

        const client = sg.getSocketById(req.body.sender.replace("@c.us","")); //sender is mobile number
        if(client == undefined)
            return res.status(401).json({error: "User session not found"});

        console.log(`message to send: ${req.body.message}`);
        console.log(`retrieved user from socket list: ${client.info.wid.user}`);

        const message = await client.sendMessage(req.body.receiver, req.body.message);
        //console.log(message);

        let sql = `INSERT INTO chats(sender, receiver, message, status, sender_name, chat_type, device_type)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `;


        await db.run(sql, [
            req.body.sender.replace("@c.us","") + '@c.us',
            req.body.receiver.replace("@c.us","") + '@c.us',
            req.body.message,
            0,
            client.info.pushname,
            'chat',
            client.info.platform
        ]);

        sql = `INSERT INTO messages(sender, receiver, message, status, sender_name, chat_type, device_type)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `;

        await db.run(sql, [
            req.body.sender.replace("@c.us","") + '@c.us',
            req.body.receiver.replace("@c.us","") + '@c.us',
            req.body.message,
            0,
            client.info.pushname,
            'chat',
            client.info.platform
        ]);


        res.status(200).json({ message: 'message sent successfully' });

    } catch (error) {
        
        var errorMessage = error.message.split(/\r?\n|\r|\n/g);
        var errorMessageLine1 = errorMessage[0];
        console.log(errorMessageLine1);
        
        res.status(500).json({ error: errorMessageLine1 });
    }
});


app.post(['/api/upload/:id','/api/upload'], async (req, res) => {
    try {
        //var id = req.params.id;

        // The below string needs to be removed from the URL query string
        // It is added by the J2ME client to force BlackBerry device to use WiFi.

        //const regex = /;interface=wifi/i;
        //id = id.replace(regex, "");

        console.log(req.files);
        console.log(`receiver = ${req.body.receiver}`);

        // Get the file that was set to our field named "media"
        const { media } = req.files;

        // If no image submitted, exit
        if (!media) return res.status(404).json({statusCode: '001', statusDesc: 'No image submitted'});

        console.log(`media received: ${media.name}`);
        
        /*
        'ascii' - for 7 bit ASCII data only. This encoding method is very fast, and will strip the high bit if set.

        'utf8' - Multi byte encoded Unicode characters. Many web pages and other document formats use UTF-8.

        'ucs2' - 2-bytes, little endian encoded Unicode characters. It can encode only BMP(Basic Multilingual Plane, U+0000 - U+FFFF).

        'base64' - Base64 string encoding.

        'binary' - A way of encoding raw binary data into strings by using only the first 8 bits of each character. 
        This encoding method is deprecated and should be avoided in favor of Buffer objects where possible. 
        This encoding will be removed in future versions of Node.

        */
        
        const client = sg.getSocketById(req.body.sender.replace("@c.us","")); //sender is mobile number
        if(client == undefined)
            return res.status(401).json({statusCode: '002', statusDesc: 'User session not found'});

        console.log(`retrieved user from socket list: ${client.info.wid.user}`);

        let fileExt;
        let fileExtTarget;
        let msg;
        let chatType;

        if(media.mimetype == 'audio/mpeg'){
            fileExt = '.mp3';
            fileExtTarget = '.ogg';
            msg = 'Audio sent';
            chatType = 'audio'
        }
        else if(media.mimetype == 'video/mp4'){
            fileExt = '.mp4';
            fileExtTarget = '.mp4';
            msg = 'Video sent';
            chatType = 'video'
        }
        else if(media.mimetype == 'image/jpeg'){
            fileExt = '.jpg';
            fileExtTarget = '.jpg';
            msg = 'Image sent';
            chatType = 'image'
        }

        console.log(`Message: ${msg}`);

        let sql = `INSERT INTO chats(sender, receiver, message, status, sender_name, chat_type, device_type)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `;

        await db.run(sql, [
            req.body.sender.replace("@c.us","") + '@c.us',
            req.body.receiver.replace("@c.us","") + '@c.us',
            msg,
            0,
            'Me',
            chatType,
            'android'
        ]);

        sql = `INSERT INTO messages(sender, receiver, message, status, sender_name, chat_type, device_type)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await db.run(sql, [
            req.body.sender.replace("@c.us","") + '@c.us',
            req.body.receiver.replace("@c.us","") + '@c.us',
            msg,
            0,
            'Me',
            chatType,
            'android'
        ]);

        let newId = result.lastID;

        const sourceMediaFilename = './media/' + newId + fileExt;

        fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'binary'));

        const targetMediaFilename = './media/' + newId + fileExtTarget;

        if(media.mimetype == 'audio/mpeg'){
            // convert mp3 audio file to "audio/ogg; codecs=opus" format which works with WhatsApp

            ffmpeg()
                .input(`${sourceMediaFilename}`)
                .outputOptions([
                '-c:a libopus',
                '-b:a 128k'
                ])
                .output(`${targetMediaFilename}`)
                .on("end", async () => {
                    console.log("Conversion finished");
                    const mediaObject = MessageMedia.fromFilePath (targetMediaFilename);

                    //mediaObject = new MessageMedia(media.mimetype, Buffer.from(media.data,'binary').toString('base64'));
                    await client.sendMessage(req.body.receiver, mediaObject);
                    res.status(200).json({statusCode: '000', statusDesc: 'media uploaded successfully'});
                })
                .on("error", (err) => {
                    console.error("Error:", err);
                    res.status(500).json({statusCode: '003', statusDesc: err.message});
                })
                .run();
        }
        else {
            const mediaObject = MessageMedia.fromFilePath (targetMediaFilename);

            //mediaObject = new MessageMedia(media.mimetype, Buffer.from(media.data,'binary').toString('base64'));
            await client.sendMessage(req.body.receiver, mediaObject);
            res.status(200).json({statusCode: '000', statusDesc: 'media uploaded successfully'});
        }


    } catch (error){
        console.log(error);
        res.status(500).json({statusCode: '003', statusDesc: error.message});
    }
});


app.get('/api/mediafile/:filename', function(req, res){

    var filename = req.params.filename;
    const regex = /;interface=wifi/i;
    filename = filename.replace(regex, "");

    const file = `${__dirname}/media/${filename}`;
    res.download(file); // Set disposition and send it.
});

app.use('/', (req, res) => {
    res.sendFile('/index.html', { root: __dirname });
});

sockserver.on('connection', (ws, req) => {
   const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

   console.log(`New client connected from ${clientIp}`);
    
    //ws.send('connection established')

// START WhatsApp client code ==========================================================================

// A WhatsApp API client that connects through the WhatsApp Web browser app 
// https://github.com/pedroslopez/whatsapp-web.js

// Reference for creating a simple bot with wwebjs library
// https://wwebjs.dev/guide/creating-your-bot/

const uuid = uuidv4();


const client = new Client({
    puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
        ]
      },
    //authStrategy: new LocalAuth({ clientId: uuid })
    authStrategy: new LocalAuth(
        { 
            clientId: uuid,
            dataPath: './data' 
        }
    )
});


/*
Uncomment below code if you want to use Chrome browser instead of open source Chromium browser that Puppeteer is using by default
You must have Chrome installed on your system to use this option

Chrome locations:
macOS: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
Windows: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
Linux: /usr/bin/google-chrome

*/

// Below URLs used for remote caching

// https://raw.githubusercontent.com/guigo613/alternative-wa-version/main/html/2.2412.54v2.html
// https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023580547-alpha.html"

/*
const client = new Client({ 
    webVersion: "2.3000.1023580547-alpha", 
    webVersionCache: { 
        type: "remote", 
        remotePath:"https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023580547-alpha.html" 
    }, 
    puppeteer: { 
        headless: false, 
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    },
    authStrategy: new LocalAuth({ clientId: uuid }) 
});
*/



client.on('ready', () => {

    // Reference to ClientInfo object:
    // https://docs.wwebjs.dev/ClientInfo.html

    console.log('Client is ready!');
    console.log(client.info.wid.user);

    sg.add(client.info.wid.user, client);


    const msg = {
        type: "login",
        pushname: client.info.pushname, 
        user: client.info.wid.user, 
        platform: client.info.platform
    };
    ws.send(JSON.stringify(msg));

    console.log('Login successful for [' 
          + msg.pushname + '] from [' + msg.user + '] using [' + msg.platform + ']');

    /*
    User.updateOne({ user: client.info.wid.user }, {
        $set:
        {
            uuid: uuid,
            ip: clientIp,
            pushname: client.info.pushname, 
            user: client.info.wid.user, 
            platform: client.info.platform

        }
    }, { upsert: true })
        .then(result => {
            console.log('Update result:', result);
            if (result.modifiedCount > 0) {
                //console.log('User updated successfully');
            } else {
                //console.log('User not found');
            }
        })
        .catch(error => {
            console.error('Error updating Users:', error);
        });
    */

    //startKeepAlive(client.info.wid.user); // Start the keep-alive mechanism here

});

// Keep-alive mechanism: Simulate typing
async function startKeepAlive(user) {
    const keepAliveInterval = 1 * 60 * 1000; // 1 minute ( change it and tell us what is the best use for that)

    setInterval(async () => {

        try {
            console.log('Simulating typing activity...');
            const chat = await client.getChatById(user); // Or a test chat
            if (chat) {
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate for 2 seconds
                await chat.clearState();
                console.log('Typing activity simulated.');
            }
        } catch (error) {
            console.error('Error simulating typing:', error.message);
        }

    }, keepAliveInterval);
}

client.on('qr', qr => {
    // Uncomment the below code for printing QR code on server side
    // qrcode.generate(qr, { small: true });
    
    // Below code for printing QR code on client side
    const msg = {
        type: "barcode",
        barcode: qr
    };

    // Return generated QR code to the webpage (login.html) thru web sockets
    ws.send(JSON.stringify(msg));

});


// Emitted when a new message is received from other users.
client.on('message', async message => {

    // below will log the group id (e.g. 120363420419601014@g.us) if message received from group
    // or it will log the user id (e.g. 966123456789@c.us) if message received from user
    console.log(`Message from: ${message.from}`);
    
    // below will log the user id (e.g. 966123456789@c.us) of the sender even if it is received from group
    let waUser = await message.getContact();
    console.log(`Sender: ${waUser.id.user}`);

    const waChat = await message.getChat();
    console.log(`Chat name: ${waChat.name}`);

    // console.log('\nlogging full message object for debugging: \n\n');
    // console.log(message);

    // console.log('\nlogging full chat object for debugging: \n\n');
    // console.log(waChat);

    // Below code for testing a message with mentions
    // await chat.sendMessage(`Hello @${user.id.user}`, {
    //     mentions: [user]
    // });
    let msg;

    if (message.type == 'ptt')
        msg = 'Voice received';
    else if (message.type == 'image')
        msg = 'Image received'; //image/jpeg, image/webp
    else if (message.type == 'audio')
        msg = 'Audio received'; //audio/ogg
    else if (message.type == 'video')
        msg = 'Video received'; //video/mp4
    else if (message.type == 'chat')
        msg = message.body;
    else
        msg = `${message.type} received`;

    console.log(`Message: ${msg}`);

    // don't log broadcast messages
    if (message.from != 'status@broadcast') {
        //await Chat.deleteMany({ sender: message.from });

        // if message from individual user, sender name will be his name
        // else if message from group chat, sender name will be group name
        let senderName = message._data.notifyName;
        if(waChat.isGroup){
            senderName = waChat.name;
        }

        await db.run(`DELETE FROM chats where sender = ?`, [message.from]);

        await db.run(`INSERT INTO chats(sender, receiver, message, status, sender_name, chat_type, device_type) 
            VALUES(?, ?, ?, ?, ?, ?, ?)`,
            [message.from, message.to, msg, 0, senderName, message.type, message.deviceType]);


        const result = 
            await db.run(`INSERT INTO messages(sender, receiver, message, status, sender_name, chat_type, device_type) 
            VALUES(?, ?, ?, ?, ?, ?, ?)`,
            [message.from, message.to, msg, 0, senderName, message.type, message.deviceType]);

        const newId = result.lastID;


        if (message.hasMedia) {
            const media = await message.downloadMedia();

            // Uncomment below code if you want to save the received Image, Audio or Video in MongoDB database instead of file system
            /*
            const image = await Image.create({
                mediaData: Buffer.from(media.data, "base64"),
                mediaFilename: media.filename,
                mediaMimetype: media.mimetype,
                mediaFilesize: media.filesize
            });
            */

            if(message.type == 'image'){
                // mediaMimetype: 'image/jpeg'
                // mediaMimetype: 'image/webp'

                const fileExt = '.jpg';

                if(media.mimetype == 'image/webp')
                    fileExt = '.webp';

                const sourceMediaFilename = './media/' + newId + fileExt;
                fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'base64'));
            }
    
            else if(message.type == 'audio' || message.type == 'ptt'){
                // mediaMimetype: 'audio/ogg; codecs=opus'

                const sourceMediaFilename = './media/' + newId + '.ogg';
                //const targetMediaFilename = './media/' + newId + '.wav';
                const targetMediaFilename = './media/' + newId + '.mp3';
    
                fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'base64'));
    
                // Old Nokia phones cannot play audio with OGG format which is used by WhatsApp
                // So convert from OGG to WAV file format

                /*
                ffmpeg()
                    .input(`${sourceMediaFilename}`)
                    .audioCodec("libvorbis")
                    .output(`${targetMediaFilename}`)
                    .audioCodec("pcm_s16le")
                    .on("end", async () => {
                        console.log("Conversion finished");
                    })
                    .on("error", (err) => {
                        console.error("Error:", err);
                    })
                    .run();
                */

                ffmpeg()
                    .input(`${sourceMediaFilename}`)
                    .audioCodec("libvorbis")
                    .output(`${targetMediaFilename}`)
                    .audioCodec("libmp3lame")
                    .on("end", async () => {
                        console.log("Conversion finished");
                    })
                    .on("error", (err) => {
                        console.error("Error:", err);
                    })
                    .run();
            }
            
            else if(message.type == 'video'){
                // mediaMimetype: 'video/mp4'

                const sourceMediaFilename = './media/' + newId + '.mp4';
                fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'base64'));

                const targetMediaFilename = './media/' + newId + '.3gp';

                // Some old Nokia phones cannot play Video in MP4 format which is used by WhatsApp
                // So convery from MP4 to 3GP file format 

                ffmpeg()
                    .input(`${sourceMediaFilename}`)
                    .outputOptions([
                    '-s 352x288',
                    '-acodec aac',
                    '-strict experimental',
                    '-ac 1',
                    '-ar 8000',
                    '-ab 24k'
                    ])
                    .output(`${targetMediaFilename}`)
                    .on("end", async () => {
                    console.log("Conversion finished");
                    })
                    .on("error", (err) => {
                    console.error("Error:", err);
                    })
                    .run();
            }
            
            
        }


    }


});

client.initialize();

// END WhatsApp client code ===========================================================================

    ws.on('close', () => console.log('Client has disconnected!'))
    ws.on('message', data => {
        sockserver.clients.forEach(client => {
            //console.log(`distributing message: ${data}`)
            //client.send(`${data}`)
        })
    })
    ws.onerror = function () {
        console.log('websocket error')
    }
});   // end socket server
