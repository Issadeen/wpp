const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const nodemailer = require('nodemailer');
const express = require('express');
const QRCode = require('qrcode');  // Add this new requirement

// Add variable to store QR code
let lastQR = '';

// Add environment detection
const isAzure = process.env.WEBSITE_HOSTNAME ? true : false;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: process.env.WEBSITE_HOSTNAME ? '/home/site/wwwroot/whatsapp-session' : './whatsapp-session'
    }),
    puppeteer: {
        handleSIGINT: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', qr => {
    // Store QR code
    lastQR = qr;
    // Also show in terminal
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log(`WhatsApp client is ready on ${isAzure ? 'Azure' : 'Local PC'}`);
});

client.on('disconnected', () => {
    console.log('Client was disconnected');
});

client.on('error', (err) => {
    console.error('Client error:', err);
    // Try to reinitialize on error
    setTimeout(() => {
        console.log('Attempting to reinitialize...');
        client.initialize().catch(console.error);
    }, 30000); // Wait 30 seconds before trying again
});

client.on('message', async msg => {
  if (msg.body.startsWith('!testGreeting')) {
    msg.reply('Greetings! The bot is working correctly.');
  } else if(msg.body.startsWith('!sendEmail')) {
    const transporter = nodemailer.createTransport({
      service: 'gmail', 
      auth: {
        user: 'your-email@example.com',
        pass: 'your-password'
      }
    });
    await transporter.sendMail({
      from: 'your-email@example.com',
      to: 'recipient@example.com',
      subject: 'WPP Bot Email',
      text: 'Email triggered from WhatsApp message!'
    });
    msg.reply('Email sent!');
  }
});

// Express server setup (single instance)
const app = express();
const port = process.env.PORT || 3000;

// Add ping tracking
let lastPing = new Date();
let isAlive = true;

// Add auto-ping endpoint
app.get('/ping', (req, res) => {
    lastPing = new Date();
    isAlive = true;
    res.json({ status: 'alive', lastPing });
});

// Update QR code endpoint to serve HTML
app.get('/qr', async (req, res) => {
    if (!lastQR) {
        // No QR available
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                </head>
                <body>
                    <h1>No QR Code Available</h1>
                    <p>Bot might be already authenticated.</p>
                    <p><a href="/qr">Refresh</a></p>
                </body>
            </html>
        `);
    }

    // Always respond with HTML
    res.setHeader('Content-Type', 'text/html');
    try {
        const qrImageURL = await QRCode.toDataURL(lastQR);
        return res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { 
                            font-family: Arial, sans-serif;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            background-color: #f0f2f5;
                        }
                        .container {
                            background: white;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                            text-align: center;
                        }
                        img {
                            max-width: 300px;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>WhatsApp QR Code</h1>
                        <img src="${qrImageURL}" alt="QR Code"/>
                        <p>Scan this QR code with WhatsApp to log in</p>
                        <p><small>Last updated: ${new Date().toLocaleString()}</small></p>
                        <p><button onclick="window.location.reload()">Refresh QR Code</button></p>
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        return res.status(500).send('Failed to generate QR code: ' + err.message);
    }
});

// Update status endpoint to include ping info
app.get('/status', (req, res) => {
    res.json({
        status: isAlive ? 'active' : 'idle',
        botName: 'CopilotBot',
        environment: isAzure ? 'Azure' : 'Local PC',
        hostName: process.env.WEBSITE_HOSTNAME || 'localhost',
        lastActive: new Date().toISOString(),
        lastPing: lastPing.toISOString(),
        authenticated: lastQR ? false : true
    });
});

app.get('/', (req, res) => {
    res.json({
        status: 'active',
        botName: 'CopilotBot',
        lastActive: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    // Initialize client only once after server starts
    client.initialize()
        .catch(err => console.error('Failed to initialize client:', err));
});

// Add auto-ping mechanism
const pingInterval = 10 * 60 * 1000; // 10 minutes
setInterval(async () => {
    try {
        const response = await fetch(`https://${process.env.WEBSITE_HOSTNAME || 'localhost:3000'}/ping`);
        const data = await response.json();
        console.log('Auto-ping successful:', data);
    } catch (err) {
        console.error('Auto-ping failed:', err);
        isAlive = false;
    }
}, pingInterval);

// Add shutdown handling
process.on('SIGTERM', () => {
    console.log('Received SIGTERM');
    isAlive = false;
});