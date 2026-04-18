const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const qrcode = require("qrcode-terminal")
const qrimage = require("qr-image"); 

const fs = require("fs");
const { PhoneNumberUtil, PhoneNumberFormat } = require("google-libphonenumber");
const phoneUtil = PhoneNumberUtil.getInstance();
const ffmpeg = require("fluent-ffmpeg");
const { db: getDb } = require("./connect.js");

const clients = {}
const authenticatedClients = {}
const qrcodes = {}

function startClient(id) {
    clients[id] = new Client({
        authStrategy: new LocalAuth({
            clientId: id
        }),
        puppeteer: { 
            headless: true, 
            executablePath: '/usr/bin/google-chrome',
            // executeablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            // executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            args: [
                 '--no-sandbox',
            ]
        },
    })

    clients[id].initialize().catch(err => console.log(err))
    
    clients[id].on("qr", (qr) => {
        // console.log(qr)
        // qrcode.generate(qr, { small: true })
        // const qr_image = qrimage.image(qr, { type: "png" });
        // qr_image.pipe(fs.createWriteStream("./public/images/qr_" + id + ".png"));
        console.log("QR code generated");

        qrcodes[id] = qr;

    })
    clients[id].on("ready", () => {

        authenticatedClients[id] = id;
        console.log("Client is ready!")
    })
    
    clients[id].on('disconnected', async (reason) => {
        console.log('Restarting client...');
        await clients[id].destroy();
        clients[id].initialize();
    });

    clients[id].on('change_state', (state) => {
        console.log('Connection state changed:', state);
        // States include: 'CONNECTED', 'CONNECTING', 'DISCONNECTED', 'PAIRING', 'PROXY_AUTH_REQUIRED', 'TIMEOUT', 'TOS_BLOCK', 'UNLAUNCHED', 'UNPAIRED', 'UNPAIRED_IDLE'
    });

    // Emitted when a new message is received from other users.
    clients[id].on('message', async message => {

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

            let senderNameForChat = message._data.notifyName;
            let senderNameForMessages = message._data.notifyName;

            if(waChat.isGroup){
                senderNameForChat = waChat.name;
            }

            console.log(`senderNameForChat: [${senderNameForChat}]`);
            console.log(`senderNameForMessages: [${senderNameForMessages}]`);

            if(senderNameForMessages == undefined)
                senderNameForMessages = message.from;

            if(senderNameForChat == undefined)
                senderNameForChat = message.from;
            
            await getDb().run(`DELETE FROM chats where sender = ?`, [message.from]);

            await getDb().run(`INSERT INTO chats(sender, receiver, message, status, sender_name, chat_type, device_type) 
                VALUES(?, ?, ?, ?, ?, ?, ?)`,
                [message.from, message.to, msg, 0, senderNameForChat, message.type, message.deviceType]);


            const result = 
                await getDb().run(`INSERT INTO messages(sender, receiver, message, status, sender_name, chat_type, device_type) 
                VALUES(?, ?, ?, ?, ?, ?, ?)`,
                [message.from, message.to, msg, 0, senderNameForMessages, message.type, message.deviceType]);

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
}



function getStatus(clientId){

    if(authenticatedClients[clientId] == undefined){
        return {
            isAuthenticated: false,
            qr: qrcodes[clientId],
            pushname: null, 
            user: null, 
            platform: null
        }
    }
    else {
        return {
            isAuthenticated: true,
            qr: qrcodes[clientId],
            pushname: clients[clientId] && clients[clientId].info && clients[clientId].info.pushname ? clients[clientId].info.pushname : "", 
            user: clients[clientId] && clients[clientId].info && clients[clientId].info.wid && clients[clientId].info.wid.user ? clients[clientId].info.wid.user : "", 
            platform: clients[clientId] && clients[clientId].info && clients[clientId].info.platform ? clients[clientId].info.platform : ""
        }
    }

}

function validate(input, countryCode) {
  try {
    if(countryCode == "0") {
        return { valid: false, reason: "Country code is required" }
    }

    const number = phoneUtil.parse(input, countryCode);
    return {
      valid: phoneUtil.isValidNumber(number),
      formatted: phoneUtil.format(number, PhoneNumberFormat.E164),
      type: phoneUtil.getNumberType(number), // 0=FIXED, 1=MOBILE, etc.
      country: phoneUtil.getRegionCodeForNumber(number),
    };
  } catch (e) {
    return { valid: false, reason: e.message };
  }
}

async function loginUser(mobileNumber) {
    
    try {
        
        const regex = /;interface=wifi/i;
        mobileNumber = mobileNumber.replace(regex, "");

        console.log(`login user = ${mobileNumber}`);

        const client = clients[mobileNumber.replace("@c.us","")]; //user is mobile number
        if(client == undefined || client.info == undefined || client.info.wid == undefined || client.info.wid.user == undefined)
            return { status: 401, data: { error: "User session not found" } };

        const user = {
            pushname: client.info.pushname, 
            user: client.info.wid.user, 
            platform: client.info.platform
        };

        return { status: 200, data: user };

    } catch (error){
        console.log(error);
        return { status: 500, data: { error: error.message } };
    }
}

async function getChats(receiver, page, pageSize) {

    try {

        const regex = /;interface=wifi/i;
        receiver = receiver.replace(regex, "");

        const client = clients[receiver.replace("@c.us","")]; //user is mobile number
        if(client == undefined)
            return { status: 401, data: { error: "User session not found" } };

        const rows = await getDb().all(`SELECT * from chats WHERE receiver = ? ORDER BY timestamp DESC LIMIT 20`, [receiver]);
        let chats = rows.map((row) => ({
                _id: row._id,
                sender: row.sender,
                senderName: row.sender_name,
                message: row.message,
                status: row.status,
                createdAt: row.timestamp,
                updatedAt: row.timestamp
            }));

        return { status: 200, data: { chats: chats } };


    } catch (error) {
        console.log(error);
        return { status: 500, data: { error: error.message } };
    }
}

async function getAllChats(mobileNumber) {
    try {
        
        const regex = /;interface=wifi/i;
        mobileNumber = mobileNumber.replace(regex, "");

        const client = clients[mobileNumber.replace("@c.us","")]; //user is mobile number
        if(client == undefined){
            return { status: 401, data: { error: "User session not found" } }
        }

        var chats = await client.getChats();

        return { status: 200, data: { chats: chats } };

    } catch (error){
        console.log(error);
        return { status: 500, data: { error: error.message } };
    }
}

async function getAllMessages(mobileNumber, chatId) {
    try {
        
        
        const regex = /;interface=wifi/i;
        mobileNumber = mobileNumber.replace(regex, "");

        const client = clients[mobileNumber.replace("@c.us","")]; //user is mobile number
        if(client == undefined)
            return { status: 401, data: { error: "User session not found" } };

        
        var chat = await client.getChatById(chatId);
        if(chat == undefined)
            return { status: 404, data: { error: "Chat not found" } };

        const messages = await chat.fetchMessages({limit: 2});
        
        return { status: 200, data: { messages: messages } };

    } catch (error){
        console.log(error);
        return { status: 500, data: { error: error.message } };
    }
}

async function getMessages(receiver, sender, page, pageSize) {
    try {

        
        
        const regex = /;interface=wifi/i;
        sender = sender.replace(regex, "");


        const client = clients[receiver.replace("@c.us","")]; //user is mobile number
        if(client == undefined)
            return { status: 401, data: { error: "User session not found" } };

        let sql = `SELECT * FROM messages where receiver in (?,?) and sender in (?,?) ORDER BY timestamp DESC LIMIT 20`;
        const rows = await getDb().all(sql, [receiver, sender, sender, receiver]);
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
            
        return { status: 200, data: { messages: messages } };



    } catch (error) {
        console.log(error);
        return { status: 500, data: { error: error.message } };
    }
}

async function getContacts(mobileNumber, searchTerm, page, pageSize) {
    try {
         const regex = /;interface=wifi/i;
        mobileNumber = mobileNumber.replace(regex, "");

        const client = clients[mobileNumber.replace("@c.us","")]; //user is mobile number
        if(client == undefined)
            return { status: 401, data: { error: "User session not found" } };

        var contacts = await client.getContacts();

        var filteredContacts =  contacts.filter(item => {
            return item.isWAContact == true 
                && item.id.server != "lid" 
                && item.isBusiness != true
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
        });

        var filteredContacts2 =  compactContactsList.filter(item => {
            return item.name.toLowerCase().includes(searchTerm.toLowerCase());
        });

        var startIndex = page * pageSize;
        var endIndex = parseInt(startIndex) + parseInt(pageSize);

        console.log(`page: ${page}, pageSize: ${pageSize}, startIndex: ${startIndex}, endIndex: ${endIndex}, count: ${filteredContacts2.length}`);

        return { status: 200, data: { contacts: filteredContacts2.slice(startIndex, endIndex), count: filteredContacts2.length } };

    } catch (error){
        console.log(error);
        return { status: 500, data: { error: error.message } };
    }
}

async function uploadMedia(media, sender, receiver){

    try {

        
        /*
        'ascii' - for 7 bit ASCII data only. This encoding method is very fast, and will strip the high bit if set.

        'utf8' - Multi byte encoded Unicode characters. Many web pages and other document formats use UTF-8.

        'ucs2' - 2-bytes, little endian encoded Unicode characters. It can encode only BMP(Basic Multilingual Plane, U+0000 - U+FFFF).

        'base64' - Base64 string encoding.

        'binary' - A way of encoding raw binary data into strings by using only the first 8 bits of each character. 
        This encoding method is deprecated and should be avoided in favor of Buffer objects where possible. 
        This encoding will be removed in future versions of Node.

        */
        
        const client = clients[sender.replace("@c.us","")]; //user is mobile number
        if(client == undefined)
            return { status: 401, data: {statusCode: '002', statusDesc: 'User session not found'} };


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

        await getDb().run(sql, [
            sender.replace("@c.us","") + '@c.us',
            receiver.replace("@c.us","") + '@c.us',
            msg,
            0,
            'Me',
            chatType,
            'android'
        ]);

        sql = `INSERT INTO messages(sender, receiver, message, status, sender_name, chat_type, device_type)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await getDb().run(sql, [
            sender.replace("@c.us","") + '@c.us',
            receiver.replace("@c.us","") + '@c.us',
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
                    await client.sendMessage(receiver, mediaObject);
                    return { status: 200, data: {statusCode: '000', statusDesc: 'media uploaded successfully'} };

                })
                .on("error", (err) => {
                    console.error("Error:", err);
                    return { status: 500, data: {statusCode: '003', statusDesc: err.message} };
                })
                .run();
        }
        else {
            const mediaObject = MessageMedia.fromFilePath (targetMediaFilename);

            //mediaObject = new MessageMedia(media.mimetype, Buffer.from(media.data,'binary').toString('base64'));
            await client.sendMessage(receiver, mediaObject);
            return { status: 200, data: {statusCode: '000', statusDesc: 'media uploaded successfully'} };
        }


    } catch (error){
        console.log(error);
        return { status: 500, data: {statusCode: '003', statusDesc: error.message} };
    }
}

async function sendMessage(sender, receiver, message) {
    try {

        const client = clients[sender.replace("@c.us","")]; //user is mobile number
        if(client == undefined)
            return { status: 401, data: {statusCode: '002', statusDesc: 'User session not found'} };

        console.log(`message to send: ${message}`);
        console.log(`retrieved user from socket list: ${client.info.wid.user}`);

        const messageReply = await client.sendMessage(receiver, message);
        //console.log(messageReply);

        let sql = `INSERT INTO chats(sender, receiver, message, status, sender_name, chat_type, device_type)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `;


        await getDb().run(sql, [
            sender.replace("@c.us","") + '@c.us',
            receiver.replace("@c.us","") + '@c.us',
            message,
            0,
            client.info.pushname,
            'chat',
            client.info.platform
        ]);

        sql = `INSERT INTO messages(sender, receiver, message, status, sender_name, chat_type, device_type)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `;

        await getDb().run(sql, [
            sender.replace("@c.us","") + '@c.us',
            receiver.replace("@c.us","") + '@c.us',
            message,
            0,
            client.info.pushname,
            'chat',
            client.info.platform
        ]);


        return { status: 200, data: { message: 'message sent successfully' } };

    } catch (error) {
        
        var errorMessage = error.message.split(/\r?\n|\r|\n/g);
        var errorMessageLine1 = errorMessage[0];
        console.log(errorMessageLine1);
        
        return { status: 500, data: { error: errorMessageLine1 } };
    }
}

async function listUsers(){
    let html = "<style>table, th, td {border: 1px solid black; border-collapse: collapse;}</style>";

    html+="<table>";
    html+= "<tr><td>User</td><td>Platform</td></tr>";


    for (var userId in clients){
        const client = clients[userId]; //userId is mobile number
        console.log(`retrieved user from socket list: ${client.info && client.info.pushname ? client.info.pushname : ""}`);
        html+="<tr>"
        html+="<td>" + (client.info && client.info.pushname ? client.info.pushname : "") + "</td>"
        html+="<td>" + (client.info && client.info.platform ? client.info.platform : "")  + "</td>"

        html+="</tr>"
    };
  
    html+="</table>";
    return html;

}

module.exports = { startClient, sendMessage, getStatus, validate, 
    getAllChats, getAllMessages, loginUser, getChats, getContacts, uploadMedia, getMessages, listUsers}
