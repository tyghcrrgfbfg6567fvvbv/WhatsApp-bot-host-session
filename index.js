const qrcode = require("qrcode-terminal")
const fs = require('fs')
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
  
  XeonBotInc.ev.on("messages.upsert", async (m) => {
    try {
      // Log new messages
      console.log(chalk.yellow("📩 New message received"));
      
      // Handle commands in the message if command handler is loaded
      if (commandHandler) {
        await commandHandler.handleCommand(XeonBotInc, m);
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