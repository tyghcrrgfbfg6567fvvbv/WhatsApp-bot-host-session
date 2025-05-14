const qrcode = require("qrcode-terminal")
const fs = require('fs')
const path = require('path')
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys")
const Pino = require("pino")
const NodeCache = require("node-cache")
const chalk = require("chalk")
const readline = require("readline")

let phoneNumber = "918822308081"

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

async function qr() {
  let { version, isLatest } = await fetchLatestBaileysVersion()
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions`)
  const msgRetryCounterCache = new NodeCache()
  const XeonBotInc = makeWASocket({
    logger: Pino({ level: 'silent' }),
    printQRInTerminal: !pairingCode,
    browser: Browsers.windows('Firefox'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
  })

  if (pairingCode && !XeonBotInc.authState.creds.registered) {
    if (useMobile) throw new Error('Cannot use pairing code with mobile api')

    let phoneNumber
    if (!!phoneNumber) {
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

      if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
        console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +916909137213")))
        process.exit(0)
      }
    } else {
      phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFor example: +916909137213 : `)))
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

      if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
        console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +916909137213")))

        phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFor example: +916909137213 : `)))
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
        rl.close()
      }
    }

    setTimeout(async () => {
      let code = await XeonBotInc.requestPairingCode(phoneNumber)
      code = code?.match(/.{1,4}/g)?.join("-") || code
      console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
    }, 3000)
  }

  XeonBotInc.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s
    if (connection == "open") {
      await delay(1000 * 2)
      let sessionXeon = fs.readFileSync('./sessions/creds.json');
      await delay(1000 * 2)
      const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { document: sessionXeon, mimetype: `application/json`, fileName: `creds.json` })

      try {
        await XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
      } catch (error) {
        console.log("Error joining group:", error.message || "Unknown error");
      }

      // Send confirmation message to bot owner
      await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `⚠️Do not share this file with anybody⚠️\n\n✅ Connection established successfully\n🔄 Session will remain active` }, {quoted: xeonses});
      
      // Send confirmation message to the same number that connected
      const connectedNumber = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;
      const formattedNumber = connectedNumber.replace('+', '') + '@s.whatsapp.net';
      
      // Only send if the number is different from the bot's own number
      if (formattedNumber !== XeonBotInc.user.id) {
        await XeonBotInc.sendMessage(formattedNumber, { 
          text: `✅ *Bot Connected Successfully*\n\n🤖 The WhatsApp bot has been successfully connected to this number.\n\n📲 You can now use bot commands in any chat.\n\nTry sending *.arise* to test the bot.` 
        });
        console.log(chalk.green(`✅ Sent confirmation message to ${connectedNumber}`));
      }
      console.log(chalk.green("✅ WhatsApp connection established successfully"));
      console.log(chalk.yellow("🔄 Session is active and ready to use"));
      // Not exiting process to keep session active
    }
    if (connection === "close" && lastDisconnect && lastDisconnect.error &&
      lastDisconnect.error.output.statusCode != 401) {
      console.log(chalk.red("⚠️ Connection closed, attempting to reconnect..."));
      qr()
    }
  })
  XeonBotInc.ev.on('creds.update', saveCreds)
  
  // Load command handler
  let commandHandler;
  try {
    commandHandler = require('./commands');
    const commandList = commandHandler.loadCommands();
    console.log(chalk.green("✅ Command handler loaded successfully"));
  } catch (error) {
    console.error("Error loading command handler:", error);
    // Creating basic empty commands folder structure if it doesn't exist
    if (!fs.existsSync('./commands')) {
      fs.mkdirSync('./commands');
      console.log(chalk.yellow("📁 Created commands directory"));
    }
  }
  
  // Function to log message details
  const logMessage = (message, direction) => {
    try {
      const sender = message.key.remoteJid;
      const senderName = message.pushName || 'Unknown';
      const messageType = Object.keys(message.message || {})[0] || 'unknown';
      let content = '';
      
      // Extract text content based on message type
      if (messageType === 'conversation') {
        content = message.message.conversation;
      } else if (messageType === 'extendedTextMessage') {
        content = message.message.extendedTextMessage.text;
      } else if (messageType === 'imageMessage') {
        content = message.message.imageMessage.caption || '[Image]';
      } else if (messageType === 'videoMessage') {
        content = message.message.videoMessage.caption || '[Video]';
      } else {
        content = `[${messageType}]`;
      }
      
      // Format and log the message
      const directionIcon = direction === 'incoming' ? '📥' : '📤';
      const colorFunction = direction === 'incoming' ? chalk.cyan : chalk.green;
      console.log(colorFunction(`${directionIcon} ${direction.toUpperCase()} [${senderName}@${sender}]: ${content}`));
    } catch (error) {
      console.error('Error logging message:', error);
    }
  };
  
  // Monitor outgoing messages
  XeonBotInc.ev.on("messages.send", async (m) => {
    try {
      logMessage(m, 'outgoing');
    } catch (error) {
      console.error("Error logging outgoing message:", error);
    }
  });
  
  // Handle incoming messages
  XeonBotInc.ev.on("messages.upsert", async (m) => {
    try {
      // Log each message in the update
      for (const message of m.messages) {
        logMessage(message, 'incoming');
      }
      
      // Handle commands in the message if command handler is loaded
      if (commandHandler) {
        await commandHandler.handleCommand(XeonBotInc, m);
      }
      
      // Handle auto-chat functionality
      try {
        // Check if auto_chat is enabled in settings
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          
          // If auto_chat is enabled and it's not a command (doesn't start with '.')
          if (settings.auto_chat && m.messages && m.messages.length > 0) {
            const msg = m.messages[0];
            if (!msg.key.fromMe && msg.message) {
              const messageContent = msg.message.conversation || 
                                  (msg.message.extendedTextMessage && 
                                    msg.message.extendedTextMessage.text) || '';
              
              // Only auto-reply if it's not a command
              if (messageContent && !messageContent.startsWith('.')) {
                const sender = msg.key.remoteJid;
                
                try {
                  // Get sender name for personalized responses
                  const senderName = msg.pushName || 'User';
                  
                  // Extract the user ID (phone number)
                  const userId = sender.split('@')[0];
                  
                  // Update user info in memory
                  const memorySystem = require('./utils/memory');
                  memorySystem.updateUserInfo(userId, {
                    name: senderName,
                    lastSeen: Date.now()
                  });
                  
                  // Use memory-aware Gemini API
                  const { generateMemoryAwareResponse } = require('./utils/gemini');
                  
                  // Show typing indicator
                  await XeonBotInc.sendPresenceUpdate('composing', sender);
                  
                  // Generate memory-aware response
                  const aiResponse = await generateMemoryAwareResponse(userId, messageContent, senderName);
                  
                  // Send the response
                  await XeonBotInc.sendMessage(sender, { 
                    text: aiResponse,
                    quoted: msg
                  });
                  console.log(chalk.blue(`🤖 Memory-aware auto-reply to ${sender} (${senderName})`));
                } catch (error) {
                  console.error("Error in Gemini response:", error);
                  // Fallback response if Gemini fails
                  await XeonBotInc.sendMessage(sender, { 
                    text: "I couldn't process that right now. You can try commands like .arise or .auto_chat on/off.",
                    quoted: msg
                  });
                }
              }
            }
          }
        }
      } catch (autoError) {
        console.error("Error in auto-chat handler:", autoError);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  })
}
qr()

process.on('uncaughtException', function (err) {
  let e = String(err)
  if (e.includes("conflict")) return
  if (e.includes("not-authorized")) return
  if (e.includes("Socket connection timeout")) return
  if (e.includes("rate-overlimit")) return
  if (e.includes("Connection Closed")) return
  if (e.includes("Timed Out")) return
  if (e.includes("Value not found")) return
  if (e.includes("resource-limit")) {
    console.log('Resource limit reached. This is often temporary, try again later or upgrade compute resources.')
    return
  }
  console.log('Caught exception: ', err)
})

process.on('warning', e => console.warn('Warning: ', e.message))

// Set up periodic memory maintenance (clean up memories older than 60 days)
setInterval(() => {
  try {
    const { cleanupOldMemories } = require('./utils/memory');
    const cleanedCount = cleanupOldMemories(60);
    if (cleanedCount > 0) {
      console.log(chalk.yellow(`🧹 Memory maintenance: Cleaned up ${cleanedCount} old user memories`));
    }
  } catch (error) {
    console.error('Error during memory maintenance:', error);
  }
}, 24 * 60 * 60 * 1000); // Run once a day