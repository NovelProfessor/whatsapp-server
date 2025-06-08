## About
**Server side code that routes traffic between WhatsApp website and my Nokia WhatsApp client written in J2ME**

This application uses the whatsapp-web.js NodeJS library to launch a headless (invisible) Chromium browser on the server to login the user using WhatsApp Web login method and then intercepts all messages and stores them in local MongoDB database where they can be fetched by my Nokia WhatsApp client thru REST APIs using HTTP requests.  You can download my Nokia WhatsApp J2ME client version 1.4+ from my website.

> [!IMPORTANT]
> **You need to have a public IP address or you can get a public endpoint from one of the services listed below to receive the HTTP requests from the Nokia WhatsApp client.**

## Links

* [My Website][website]
* [My reddit page][reddit]

## Installation

This application requires MongoDB and NodeJS to run.

### Install MongoDB 8.0 Community Edition
Just follow the installation instructions for your operating system on the [official Mongo website][mongodb]

### Install NodeJS
Just get the latest LTS from the [official node website][nodejs].

> [!NOTE]
> **Node ``v18+`` is required.**

### Install the NodeJS dependencies
After installing NodeJS, open a terminal or command prompt, go into the project folder and run the below command to install the dependencies.  Note that "sudo" keyword is only required for MacOS and Linux, not for Windows.

```powershell
sudo npm install
```

## Running the server
Open a terminal or command prompt, Go into the project folder and run the below command to launch the server on port 80 by default.  Note that "sudo" keyword is only required for MacOS and Linux, not for Windows.  If you are hosting this server on a public VPS (Virtual Private Server) then I recommend running the script using [PM2 process manager for NodeJS][pm2]

```powershell
sudo node server.js
```

Wait for the server started and DB connected message to appear in the terminal, then open a browser and open the login page "http://localhost/login" to scan the QR code from your iPhone or Android where you are already logged in to WhatsApp.

## Connecting the client with the server
When you launch my J2ME Nokia WhatsApp client version 1.4+, you can replace my server URL "nokia4ever.com" with your public IP address, e.g "92.113.151.149" inside the J2ME WhatsApp client and also inside the login.html page on the server.

If you don't have a public IP address, you can get a public endpoint from an API gateway service provider to receive traffic on your local server.  It has to be accessible thru HTTP, not HTTPS, since old Nokia phones don't support TLS 1.2

### Get a public endpoint from API gateway
I recommend getting a public endpoint from NGROK, they are the most reliable, most feature rich and oldest provider of such a service and this is the one I use for my projects.  Go to their official website [NGROK API Gateway][ngrok] and register for an account.  Then you need to go to the "Universal Gateway > TCP Addresses" menu option on the left side and create 2 TCP address endpoints.  Download their NGROK command line tool (on windows you need to disable the Windows Defender as it thinks this tool is a virus).  

Suppoose the 2 TCP addresses you created are "5.tcp.ngrok.io:25805" and "7.tcp.ngrok.io:21149".  Then you will need to open 2 separate terminal windows, go to the folder where you downloaded the NGROK command line tool and run the below commands and keep them running:

#### Forward traffic on port 80 for HTTP Rest API calls
Run the below command from terminal.  When you launch the J2ME Nokia WhatsApp client, the server URL will be "http://5.tcp.ngrok.io:25805".  Replace the address with your address.
```powershell
ngrok tcp --region=us --remote-addr=5.tcp.ngrok.io:25805 80  
```

#### Forward traffic on port 443 for returning QR code thru WebSocket
Run the below command from another terminal.  Replace the address with your address.
```powershell
ngrok tcp --region=us --remote-addr=7.tcp.ngrok.io:21149 443
```

#### Modify the login page to connect to your server
Open the login.html page in an editor and update the below line with your web socket address which you configured above to receive the QR code from the server.
```
const webSocket = new WebSocket('ws://7.tcp.ngrok.io:21149/');
```

> [!NOTE]
> Creating TCP Address on NGROK requires upgrading the free account to Pay-as-you-go account which costs minimum 8 dollars per month.

### Other public endpoint providers
Below is a list of other providers who offer similar service.

[localtunnel.me][localtunnel]

[pinggy.io][pinggy]

[onionpipe][onionpipe]

[tunnelmole][tunnelmole]

## Supported features

| Feature  | Status |
| ------------- | ------------- |
| Multiple Users  | ✅  |
| Send messages  | ✅  |
| Receive messages  | ✅  |
| Send images  | ✅  |
| Receive images  | ✅  |
| Send media (audio)  | ❌ (codec not supported by Chromium)  |
| Receive media (audio)  | ✅ |
| Send media (video)  | ❌ (codec not supported by Chromium)  |
| Receive media (video)  | ✅ |
| Send stickers | ❌ (not yet) |
| Send contact cards | ❌ (not yet) |
| Send location | ❌ (not yet) |
| Receive location | ❌ (not yet) |
| Join groups by invite  | ❌ (not yet) |
| Get invite for group  | ❌ (not yet) |
| Modify group info (subject, description)  | ❌ (not yet)  |
| Modify group settings (send messages, edit info)  | ❌ (not yet)  |
| Add group participants  | ❌ (not yet) |
| Kick group participants  | ❌ (not yet) |
| Promote/demote group participants | ❌ (not yet) |
| Mention users | ❌ (not yet) |
| Mention groups | ❌ (not yet) |
| Mute/unmute chats | ❌ (not yet) |
| Block/unblock contacts | ❌ (not yet) |
| Get contact info | ❌ (not yet) |
| Get profile pictures | ❌ (not yet) |
| Set user status message | ❌ (not yet) |
| React to messages | ❌ (not yet) |

## Contact Me

I don't have time for live chat, if you want to ask something or provide your feedback then Reply to my post on Reddit or send me an email on novelprofessor@gmail.com

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at [whatsapp.com][whatsapp]. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners. Also it is not guaranteed you will not be blocked by using this method. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## License

Copyright 2025 Novel Professor  

Licensed under the Apache License, Version 2.0 (the "License");  
you may not use this project except in compliance with the License.  
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.  

Unless required by applicable law or agreed to in writing, software  
distributed under the License is distributed on an "AS IS" BASIS,  
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  
See the License for the specific language governing permissions and  
limitations under the License.  


[website]: http://nokia4ever.com
[reddit]: https://www.reddit.com/user/Novel-Professor3366
[nodejs]: https://nodejs.org/en/download/
[mongodb]: https://www.mongodb.com/docs/manual/administration/install-community/
[pm2]: https://pm2.keymetrics.io/
[localtunnel]: https://localtunnel.me/
[ngrok]: https://ngrok.com/
[pinggy]: http://pinggy.io/
[onionpipe]: https://github.com/cmars/onionpipe
[tunnelmole]: https://tunnelmole.com/
[whatsapp]: https://whatsapp.com