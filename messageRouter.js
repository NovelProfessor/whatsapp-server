
const express = require('express');
const router = new express.Router();

const { 
  startClient, sendMessage, isAuthenticated, 
  getStatus, validate, getAllChats, getAllMessages, 
  loginUser, getChats, getContacts, uploadMedia, getMessages, listUsers 
} = require("./WhatsappClient")

const multer  = require('multer')
const upload = multer()

router.get('/', (req, res) => {
  res.sendFile('/index.html', { root: __dirname });
});

// The below endpoint is only used by my website to allow users to download my WhatsApp application
// It is not used by the J2ME WhatsApp client

router.get('/download/:filename', function(req, res){
    const file = `${__dirname}/${req.params.filename}`;
    res.download(file); // Set disposition and send it.
});

router.get('/api/mediafile/:filename', function(req, res){

    var filename = req.params.filename;
    const regex = /;interface=wifi/i;
    filename = filename.replace(regex, "");

    const file = `${__dirname}/media/${filename}`;
    res.download(file); // Set disposition and send it.
});

router.get('/login', (req, res) => {
    res.sendFile('/login.html', { root: __dirname });
});

router.get("/login-status/:phoneNumber", (req, res) => {
  res.json(getStatus(req.params.phoneNumber))
});


router.get('/:country/:phoneNumber/start', (req, res) => {

  const result = validate(req.params.phoneNumber, req.params.country)
  if(!result.valid) {
    res.status(200).json(result)
    return;
  }
  const formattedNumber = result.formatted.replace("+", "");

  console.log(`Starting client for ${formattedNumber}`)

  startClient(formattedNumber)
  res.status(200).json({valid: true, formatted: formattedNumber})
})

// The below endpoint is called by the J2ME WhatsApp client to login to the app
// :user is a path variable which will contain the mobile number of the user who is logging in
// The string ';interface=wifi' gets added to the URL just to force BlackBerry (OS 6 and 7) devices to use WiFi

router.get('/api/login/:user', async (req, res) => {
    var mobileNumber = req.params.user;

    const result = await loginUser(mobileNumber);

    res.status(result.status).json(result.data);  

});

// The below endpoint is called by the J2ME WhatsApp client to list the Chats in the chats screen
// The string ';interface=wifi' gets added to the URL just to force BlackBerry (OS 6 and 7) devices to use WiFi

router.get('/api/chats/:receiver', async (req, res) => {
    var receiver = req.params.receiver;

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

    const result = await getChats(receiver, page, pageSize);

    res.status(result.status).json(result.data);
});

router.get('/api/contacts/:user', async(req, res) => {

    var mobileNumber = req.params.user;

    var pageSize = 30, page = 0;
    const regex = /;interface=wifi/i;
    var searchTerm='';
        
    if(req.query.search_term !== undefined && req.query.search_term !== ''){
        searchTerm = req.query.search_term;
        searchTerm = searchTerm.replace(regex, "");
    }

    if(req.query.page_size !== undefined && req.query.page_size !== ''){
        pageSize = req.query.page_size;
        pageSize = pageSize.replace(regex, "");
    }

    if(req.query.page !== undefined && req.query.page !== ''){
        page = req.query.page;
        page = page.replace(regex, "");
    }  

    const result = await getContacts(mobileNumber, searchTerm, page, pageSize);

    res.status(result.status).json(result.data); 

});

// The below endpoint is called by the J2ME WhatsApp client to fetch all the messages received by the logged in user from the selected sender
// :receiver is the mobile number of the logged in user
// :sender is the mobile number of the person who sent you the messages
// The string ';interface=wifi' gets added to the URL just to force BlackBerry (OS 6 and 7) devices to use WiFi

router.get('/api/messages/:receiver/:sender', async (req, res) => {

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
    var receiver = req.params.receiver;
    var sender = req.params.sender;

    const result = await getMessages(receiver, sender, page, pageSize);

    res.status(result.status).json(result.data); 

});

router.post(['/api/messages','/api/messages/:id'], async (req, res) => {

    const result = await sendMessage(req.body.sender, req.body.receiver, req.body.message);

    res.status(result.status).json(result.data);
});

router.get('/api/allchats/:user', async(req, res) => {
    var mobileNumber = req.params.user;

    const result = await getAllChats(mobileNumber);

    res.status(result.status).json(result.data);

});

router.get('/api/allmessages/:user/:chatId', async(req, res) => {
    var mobileNumber = req.params.user;
    var chatId = req.params.chatId;

    const result = await getAllMessages(mobileNumber, chatId);

    res.status(result.status).json(result.data);

});

router.post(['/api/upload/:id','/api/upload'], async (req, res) => {
    try {

        console.log(req.files);
        console.log(`receiver = ${req.body.receiver}`);

        // Get the file that was set to our field named "media"
        const { media } = req.files;

        // If no image submitted, exit
        if (!media) return res.status(404).json({statusCode: '001', statusDesc: 'No image submitted'});

        console.log(`media received: ${media.name}`);

        const result = await uploadMedia(media, req.body.sender, req.body.receiver);

        res.status(result.status).json(result.data);

    } catch (error){
        console.log(error);
        res.status(500).json({statusCode: '003', statusDesc: error.message});
    }

});

router.get('/listusers', async (req,res) =>{
    
    // Reference to ClientInfo object:
    // https://docs.wwebjs.dev/ClientInfo.html

    const result = await listUsers();

    res.send(result);

});

module.exports = router