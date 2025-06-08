var sg = require("./singleton.js");
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const port = process.env.PORT || 80;
const fileUpload = require('express-fileupload');
const mongoose = require('mongoose');
const { WebSocketServer, CLOSING } = require('ws');
const { v4: uuidv4 } = require("uuid");

// FFMPEG library is used to convert WhatsApp audio and video to a format that is compatible with old Nokia phones
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
var ffmpeg = require('fluent-ffmpeg'), fs = require('fs');
ffmpeg.setFfmpegPath(ffmpegPath);

// Use the express-fileupload middleware
app.use(fileUpload());

const Message = require('./models/message.model.js');
const Chat = require('./models/chat.model.js');
const User = require('./models/user.model.js');
const Image = require('./models/image.model.js');
const { execPath } = require("process");


app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

const sockserver = new WebSocketServer({ port: 443 });


mongoose.connect('mongodb://127.0.0.1:27017/messagedb')
    .then(() => {
        console.log('Connected to database');
        console.log('Now open "http://localhost/login" in your browser to login to WhatsApp');

    })
    .catch(() => {
        console.log('Error connecting to database')
    });

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


        const chats = await Chat.find({ receiver: receiver })
            .select('sender senderName message createdAt updatedAt status')
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * page);


            Chat.updateMany({ receiver: receiver }, {
                $set:
                {
                    status: 1
                }
            }, { upsert: false })
                .then(result => {
                    //console.log('Update result:', result);
                    if (result.modifiedCount > 0) {
                        //console.log('Message updated successfully');
                    } else {
                        //console.log('Message not found');
                    }
                })
                .catch(error => {
                    console.error('Error updating Message:', error);
                });


        res.status(200).json({ chats: chats });

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
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

        const messages = await Message.find({
            $or: [
                { receiver: receiver, sender: sender },
                { receiver: sender, sender: receiver }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * page);

        res.status(200).json({ messages: messages });

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});



app.get('/users4483', async (req,res) =>{
    
    // Reference to ClientInfo object:
    // https://docs.wwebjs.dev/ClientInfo.html

    let html = "<style>table, th, td {border: 1px solid black; border-collapse: collapse;}</style>";

    html+="<table>";
    html+= "<tr><td>User</td><td>Platform</td><td>Mobile</td></tr>";

    const clients = sg.getSocketList();

    for (var userId in clients){
        const client = sg.getSocketById(userId); //userId is mobile number
        console.log(`retrieved user from socket list: ${client.info.pushname}`);
        html+="<tr>"
        html+="<td>" + client.info.pushname + "</td>"
        html+="<td>" + client.info.platform + "</td>"
        let mobile = client.info.wid.user;
        //html+="<td>" + mobile.substr(0,3) + "xxxx" + mobile.substr(mobile.length - 3) + "</td>"
        html+="<td>" + mobile + "</td>"
        html+="</tr>"
    };
  
    html+="</table>";

    res.send(html);

});

app.post('/api/messages/:id', async (req, res) => {
    try {

        const client = sg.getSocketById(req.body.sender.replace("@c.us","")); //sender is mobile number
        if(client == undefined)
            return res.status(401).json({error: "User session not found"});

        console.log(`message to send: ${req.body.message}`);
        console.log(`retrieved user from socket list: ${client.info.wid.user}`);

        const message = await client.sendMessage(req.body.receiver, req.body.message);
        //console.log(message);

        await Chat.create({
            sender: req.body.sender.replace("@c.us","") + '@c.us',
            receiver: req.body.receiver.replace("@c.us","") + '@c.us',
            message: req.body.message,
            status: 0,
            senderName: 'Me',
            chatType: 'chat',
            deviceType: 'android'
            

        });


        const newMessage = await Message.create({
            sender: req.body.sender.replace("@c.us","") + '@c.us',
            receiver: req.body.receiver.replace("@c.us","") + '@c.us',
            message: req.body.message,
            status: 0,
            senderName: 'Me',
            chatType: 'chat',
            deviceType: 'android'

        });


        res.status(200).json({ message: 'message sent successfully' });

    } catch (error) {
        var errorMessage = error.message.split(/\r?\n|\r|\n/g);
        var errorMessageLine1 = errorMessage[0];
        console.log(errorMessageLine1);
        
        res.status(500).json({ error: errorMessageLine1 });
    }
});


app.post('/api/upload/:id', async (req, res) => {
    try {
        var id = req.params.id;

        // The below string needs to be removed from the URL query string
        // It is added by the J2ME client to force BlackBerry device to use WiFi.

        const regex = /;interface=wifi/i;
        id = id.replace(regex, "");

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
        
        

        // We have both options, either send image to WhatsApp directly from the bytes received in the request
        // or from the file we saved in the filesystem from above statement
        // Here I am choosing to send from bytes received and commented out the lines for sending from file system

        const mediaObject = new MessageMedia(media.mimetype, Buffer.from(media.data,'binary').toString('base64'));

        
        const client = sg.getSocketById(req.body.sender.replace("@c.us","")); //sender is mobile number
        if(client == undefined)
            return res.status(401).json({statusCode: '002', statusDesc: 'User session not found'});

        console.log(`retrieved user from socket list: ${client.info.wid.user}`);

        await client.sendMessage(req.body.receiver, mediaObject);

        // Move the uploaded image / video or audio file to our media folder
        // const sourceMediaFilename = './media/' + media.name;
        // media.mv(sourceMediaFilename);

        // We can use the above media.mv async method provided by express file-upload module or NodeJS built-in writeFileSync.
        // I prefer to use writeFileSync because I need to wait for file copy to be complete before performing next action

        // fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'ascii'));

        //const mediaObject = MessageMedia.fromFilePath(sourceMediaFilename);

        await Chat.create({
            sender: req.body.sender.replace("@c.us","") + '@c.us',
            receiver: req.body.receiver.replace("@c.us","") + '@c.us',
            message: 'Image sent',
            status: 0,
            senderName: 'Me',
            chatType: 'image',
            deviceType: 'android'
            

        });


        const newMessage = await Message.create({
            sender: req.body.sender.replace("@c.us","") + '@c.us',
            receiver: req.body.receiver.replace("@c.us","") + '@c.us',
            message: 'Image sent',
            status: 0,
            senderName: 'Me',
            chatType: 'image',
            deviceType: 'android'

        });

        let fileExt = '.jpg';

        if(media.mimetype == 'audio/wav')
            fileExt = '.wav';

        const sourceMediaFilename = './media/' + newMessage._id + fileExt;
        fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'ascii'));

        ////const mediaObject = MessageMedia.fromFilePath(sourceMediaFilename);
        ////await client.sendMessage(req.body.receiver, mediaObject);

        res.status(200).json({statusCode: '000', statusDesc: 'media uploaded successfully'});

    } catch (error){
        console.log(error);
        res.status(500).json({statusCode: '003', statusDesc: error.message});
    }
});


app.get("/api/media/:id", (req, res) => {

    var id = req.params.id;
    const regex = /;interface=wifi/i;
    id = id.replace(regex, "");

    Image.findById(id)
      .then((image) => {
        res.setHeader("Content-Type", image.mediaMimetype);
        res.send(image.mediaData);
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send("Error retrieving image");
      });
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
    authStrategy: new LocalAuth({ clientId: uuid })
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


});

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

    // don't log broadcast messages
    if (message.from != 'status@broadcast') {
        await Chat.deleteMany({ sender: message.from });

        // if message from individual user, sender name will be his name
        // else if message from group chat, sender name will be group name
        let senderName = message._data.notifyName;
        if(waChat.isGroup){
            senderName = waChat.name;
        }

        await Chat.create({
            sender: message.from,
            receiver: message.to,
            message: msg,
            status: 0,
            senderName: senderName,
            chatType: message.type,
            deviceType: message.deviceType,
            

        });


        const newMessage = await Message.create({
            sender: message.from,
            receiver: message.to,
            message: msg,
            status: 0,
            senderName: message._data.notifyName,
            chatType: message.type,
            deviceType: message.deviceType

        });

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

                const sourceMediaFilename = './media/' + newMessage._id + fileExt;
                fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'base64'));
            }
    
            else if(message.type == 'audio'){
                // mediaMimetype: 'audio/ogg; codecs=opus'

                const sourceMediaFilename = './media/' + newMessage._id + '.ogg';
                const targetMediaFilename = './media/' + newMessage._id + '.wav';
    
                fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'base64'));
    
                // Old Nokia phones cannot play audio with OGG format which is used by WhatsApp
                // So convert from OGG to WAV file format

                
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
            }
            
            else if(message.type == 'video'){
                // mediaMimetype: 'video/mp4'

                const sourceMediaFilename = './media/' + newMessage._id + '.mp4';
                fs.writeFileSync(sourceMediaFilename, Buffer.from(media.data, 'base64'));

                const targetMediaFilename = './media/' + newMessage._id + '.3gp';

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
});
