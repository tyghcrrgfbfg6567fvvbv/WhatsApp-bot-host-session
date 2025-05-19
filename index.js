const fs = require('fs')
const path = require('path')
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys")
const Pino = require("pino")
const PinoPretty = require("pino-pretty")
const NodeCache = require("node-cache")
const chalk = require("chalk")
const readline = require("readline")

// Create Express app and HTTP server
const app = express()
const server = http.createServer(app)
const io = socketIo(server)

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const phoneNumber = req.body.phoneNumber.replace(/[^0-9]/g, '')
    const sessionDir = path.join(__dirname, 'sessions', phoneNumber)
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }
    
    cb(null, sessionDir)
  },
  filename: function (req, file, cb) {
    cb(null, 'creds.json')
  }
})

const upload = multer({ storage: storage })

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

// Store active sessions
const activeSessions = new Map()

// Custom logger that captures logs for the web interface
const loggers = new Map()

/**
 * Custom logging function that sends logs only to the web interface, not to the terminal
 * @param {string} sessionId - ID of the session
 * @param {string} type - Type of log (info, warn, error)
 * @param {string} message - Log message
 */
function sendLog(sessionId, type, message) {
  // Create formatted log object
  const logObj = {
    sessionId,
    timestamp: new Date().toISOString(),
    type,
    message
  };
  
  // Store in session logs if session exists
  const sessionLogger = loggers.get(sessionId);
  if (sessionLogger && sessionLogger.logStream) {
    sessionLogger.logStream.logs.push(logObj);
    
    // Keep only the last 1000 logs
    if (sessionLogger.logStream.logs.length > 1000) {
      sessionLogger.logStream.logs.shift();
    }
  }
  
  // Emit to all connected clients
  io.emit('logMessage', logObj);
}

function createLogger(sessionId) {
  // Create a simple log storage array
  const logs = [];
  
  // Create a simple logger object that doesn't rely on streams
  const logger = {
    info: (message) => {
      const formattedLog = {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: typeof message === 'object' ? JSON.stringify(message) : message
      };
      
      // Add to logs array
      logs.push(formattedLog);
      
      // Keep only the last 1000 logs
      if (logs.length > 1000) {
        logs.shift();
      }
      
      // Emit to web interface
      io.emit('logMessage', {
        sessionId,
        ...formattedLog
      });
      
      // No console logging
    },
    warn: (message) => {
      const formattedLog = {
        timestamp: new Date().toISOString(),
        type: 'warn',
        message: typeof message === 'object' ? JSON.stringify(message) : message
      };
      
      logs.push(formattedLog);
      if (logs.length > 1000) logs.shift();
      
      io.emit('logMessage', {
        sessionId,
        ...formattedLog
      });
      
      // No console logging
    },
    error: (message) => {
      const formattedLog = {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: typeof message === 'object' ? JSON.stringify(message) : message
      };
      
      logs.push(formattedLog);
      if (logs.length > 1000) logs.shift();
      
      io.emit('logMessage', {
        sessionId,
        ...formattedLog
      });
      
      // No console logging
    }
  };
  
  // Create a simple logStream object that just stores logs
  const logStream = { logs };
  
  // Store in the loggers map
  loggers.set(sessionId, { logger, logStream });
  
  return { logger, logStream };
}

/**
 * Start a WhatsApp session for a specific phone number
 * @param {string} phoneNumber - The phone number to connect (with country code)
 * @param {string} sessionId - Unique ID for this session
 * @param {string} sessionName - Optional name for this session
 * @param {boolean} usePairingCode - Whether to use pairing code for authentication
 * @returns {Promise<Object>} - Session information
 */
async function startWhatsAppSession(phoneNumber, sessionId, sessionName = '', usePairingCode = true) {
  // Create a logger for this session
  const { logger, logStream } = createLogger(sessionId);
  
  // Clean up phone number format
  phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
  
  // Create session directory if it doesn't exist
  const sessionDir = path.join(__dirname, 'sessions', phoneNumber);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  
  // Log session start
  sendLog(sessionId, 'info', `Starting WhatsApp session for ${phoneNumber} (${sessionName || 'Unnamed'})`);
  
  try {
    // Fetch latest Baileys version
    let { version, isLatest } = await fetchLatestBaileysVersion();
    sendLog(sessionId, 'info', `Using Baileys version ${version} (Latest: ${isLatest})`);
    
    // Initialize auth state
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const msgRetryCounterCache = new NodeCache();
    
    // Create a dummy logger for Baileys
    const dummyLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
      child: () => dummyLogger // Return self for child loggers
    };
    
    // Create WhatsApp socket connection with a silent logger
    const XeonBotInc = makeWASocket({
      logger: dummyLogger,
      printQRInTerminal: false, // We'll handle QR codes ourselves
      browser: Browsers.windows('Firefox'),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, dummyLogger),
      },
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      msgRetryCounterCache,
      defaultQueryTimeoutMs: undefined,
    });
    
    // Create session object to track this connection
    const sessionInfo = {
      id: sessionId,
      phoneNumber: phoneNumber,
      name: sessionName || phoneNumber,
      startTime: new Date(),
      status: 'Connecting',
      messageCount: 0,
      socket: XeonBotInc,
      logger,
      logStream
    };
    
    // Store session in active sessions map
    activeSessions.set(sessionId, sessionInfo);
    
    // Emit session status update
    io.emit('sessionStatusUpdate', {
      id: sessionId,
      phoneNumber: phoneNumber,
      name: sessionName || phoneNumber,
      status: 'Connecting',
      startTime: sessionInfo.startTime
    });
    
    // Request pairing code if needed
    if (usePairingCode && !XeonBotInc.authState.creds.registered) {
      sendLog(sessionId, 'info', `Requesting pairing code for ${phoneNumber}`);
      
      setTimeout(async () => {
        try {
          let code = await XeonBotInc.requestPairingCode(phoneNumber);
          code = code?.match(/.{1,4}/g)?.join("-") || code;
          
          sendLog(sessionId, 'info', `Pairing code generated: ${code}`);
          
          // Emit pairing code to web interface
          io.emit('pairingCode', {
            sessionId,
            phoneNumber,
            code
          });
        } catch (error) {
          sendLog(sessionId, 'error', `Error generating pairing code: ${error.message}`);
          
          // Emit error to web interface
          io.emit('sessionStatus', {
            sessionId,
            phoneNumber,
            status: 'error',
            message: `Error generating pairing code: ${error.message}`
          });
        }
      }, 3000);
    }
    
    // Handle connection updates
    XeonBotInc.ev.on("connection.update", async (s) => {
      const { connection, lastDisconnect } = s;
      
      if (connection === "open") {
        // Update session status
        sessionInfo.status = 'Connected';
        
        // Emit session status update
        io.emit('sessionStatus', {
          sessionId,
          phoneNumber,
          status: 'connected'
        });
        
        io.emit('sessionStatusUpdate', {
          id: sessionId,
          status: 'Connected'
        });
        
        sendLog(sessionId, 'info', `WhatsApp connection established successfully for ${phoneNumber}`);
        
        // Send confirmation message to bot owner
        try {
          await XeonBotInc.sendMessage(XeonBotInc.user.id, { 
            text: `\u2705 *Bot Connected Successfully*\n\n\ud83e\udd16 The WhatsApp bot has been successfully connected.\n\n\ud83d\udcf2 You can now use bot commands in any chat.\n\nTry sending *.arise* to test the bot.` 
          });
          sendLog(sessionId, 'info', `Sent confirmation message to ${XeonBotInc.user.id}`);
        } catch (error) {
          sendLog(sessionId, 'error', `Error sending confirmation message: ${error.message}`);
        }
      }
      
      if (connection === "close") {
        // Update session status
        sessionInfo.status = 'Disconnected';
        
        // Emit session status update
        io.emit('sessionStatusUpdate', {
          id: sessionId,
          status: 'Disconnected'
        });
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        
        if (shouldReconnect) {
          sendLog(sessionId, 'warn', `Connection closed, attempting to reconnect...`);
          
          // Remove the session from active sessions
          activeSessions.delete(sessionId);
          
          // Start a new session with the same parameters
          setTimeout(() => {
            startWhatsAppSession(phoneNumber, sessionId, sessionName, false);
          }, 5000);
        } else {
          sendLog(sessionId, 'error', `Connection closed permanently (logged out)`);
          
          // Remove the session from active sessions
          activeSessions.delete(sessionId);
          
          // Emit session stopped event
          io.emit('sessionStopped', sessionId);
        }
      }
    });
    
    // Handle credentials update
    XeonBotInc.ev.on('creds.update', saveCreds);
    
    // Load command handler
    let commandHandler;
    try {
      commandHandler = require('./commands');
      const commandList = commandHandler.loadCommands();
      console.log(`Command handler loaded successfully with ${commandList.size} commands`);
    } catch (error) {
      console.error(`Error loading command handler: ${error.message}`);
      
      // Creating basic empty commands folder structure if it doesn't exist
      if (!fs.existsSync('./commands')) {
        fs.mkdirSync('./commands');
        console.log(`Created commands directory`);
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
        
        // Format log message
        const logMsg = `${direction.toUpperCase()} [${senderName}@${sender}]: ${content}`;
        
        // Log to console and web interface
        if (direction === 'incoming') {
          // Use our custom logging function
          sendLog(sessionId, 'info', logMsg);
          
          // Emit log message with special type for UI formatting (in addition to sendLog)
          io.emit('logMessage', {
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'incoming',
            message: logMsg
          });
          
          // Increment message counter
          sessionInfo.messageCount++;
          
          // Emit session status update with new message count
          io.emit('sessionStatusUpdate', {
            id: sessionId,
            messageCount: sessionInfo.messageCount
          });
        } else {
          // Use our custom logging function
          sendLog(sessionId, 'info', logMsg);
          
          // Emit log message with special type for UI formatting (in addition to sendLog)
          io.emit('logMessage', {
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'outgoing',
            message: logMsg
          });
        }
      } catch (error) {
        sendLog(sessionId, 'error', `Error logging message: ${error.message}`);
      }
    };
    
    // Monitor outgoing messages
    XeonBotInc.ev.on("messages.send", async (m) => {
      try {
        logMessage(m, 'outgoing');
      } catch (error) {
        sendLog(sessionId, 'error', `Error logging outgoing message: ${error.message}`);
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
                    
                    // Get conversation history for context
                    const history = memorySystem.getConversationHistory(userId, 5);
                    
                    // Add user message to memory
                    memorySystem.addMessageToMemory(userId, 'user', messageContent);
                    
                    // Generate AI response using Gemini
                    const geminiUtil = require('./utils/gemini');
                    await geminiUtil.generateMemoryAwareResponse(userId, messageContent, senderName, XeonBotInc);
                  } catch (error) {
                    sendLog(sessionId, 'error', `Error in auto-chat: ${error.message}`);
                  }
                }
              }
            }
          }
        } catch (error) {
          sendLog(sessionId, 'error', `Error checking auto-chat settings: ${error.message}`);
        }
      } catch (error) {
        sendLog(sessionId, 'error', `Error handling incoming messages: ${error.message}`);
      }
    });
    
    return sessionInfo;
  } catch (error) {
    sendLog(sessionId, 'error', `Error starting WhatsApp session: ${error.message}`);
    
    // Emit error to web interface
    io.emit('sessionStatus', {
      sessionId,
      phoneNumber,
      status: 'error',
      message: `Error starting session: ${error.message}`
    });
    
    // Remove the session from active sessions
    activeSessions.delete(sessionId);
    
    throw error;
  }
}

// API Routes

// Get all active sessions
app.get('/api/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.values()).map(session => ({
    id: session.id,
    phoneNumber: session.phoneNumber,
    name: session.name,
    status: session.status,
    startTime: session.startTime,
    messageCount: session.messageCount
  }));
  
  res.json(sessions);
});

// Start a new session with pairing code
app.post('/api/sessions', async (req, res) => {
  try {
    const { phoneNumber, sessionName } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Generate a unique session ID
    const sessionId = uuidv4();
    
    // Start the WhatsApp session
    await startWhatsAppSession(phoneNumber, sessionId, sessionName, true);
    
    res.json({ 
      success: true, 
      sessionId,
      message: 'Session started successfully. Check the web interface for the pairing code.'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to start session', 
      message: error.message 
    });
  }
});

// Stop a session
app.delete('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Logout and close the connection
    session.socket.logout();
    session.socket.end();
    
    // Remove from active sessions
    activeSessions.delete(sessionId);
    
    // Emit session stopped event
    io.emit('sessionStopped', sessionId);
    
    res.json({ success: true, message: 'Session stopped successfully' });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to stop session', 
      message: error.message 
    });
  }
});

// Upload credentials file
app.post('/api/upload-credentials', upload.single('credentialsFile'), async (req, res) => {
  try {
    const { phoneNumber, sessionName } = req.body;
    
    if (!phoneNumber || !req.file) {
      return res.status(400).json({ 
        error: 'Phone number and credentials file are required' 
      });
    }
    
    // Generate a unique session ID
    const sessionId = uuidv4();
    
    // Start the WhatsApp session with the uploaded credentials
    await startWhatsAppSession(phoneNumber, sessionId, sessionName, false);
    
    res.json({ 
      success: true, 
      sessionId,
      message: 'Credentials uploaded and session started successfully.'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to upload credentials', 
      message: error.message 
    });
  }
});

// Command Management API

// Get all commands
app.get('/api/commands', (req, res) => {
  try {
    const commandsDir = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsDir)) {
      return res.json([]);
    }
    
    const commandFiles = fs.readdirSync(commandsDir)
      .filter(file => file.endsWith('.js') && file !== 'index.js');
    
    const commands = commandFiles.map(file => {
      const filePath = path.join(commandsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract command metadata from JSDoc comments
      const nameMatch = content.match(/name:\s*['"](.*?)['"]/);
      const descMatch = content.match(/description:\s*['"](.*?)['"]/);
      
      return {
        name: nameMatch ? nameMatch[1] : file.replace('.js', ''),
        description: descMatch ? descMatch[1] : 'No description available'
      };
    });
    
    res.json(commands);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get commands', 
      message: error.message 
    });
  }
});

// Get a specific command
app.get('/api/commands/:name', (req, res) => {
  try {
    const { name } = req.params;
    const filePath = path.join(__dirname, 'commands', `${name}.js`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Command not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract command metadata from JSDoc comments
    const titleMatch = content.match(/title:\s*['"](.*?)['"]/);
    const descMatch = content.match(/description:\s*['"](.*?)['"]/);
    const exampleMatch = content.match(/example:\s*['"](.*?)['"]/);
    
    res.json({
      name,
      title: titleMatch ? titleMatch[1] : '',
      description: descMatch ? descMatch[1] : '',
      example: exampleMatch ? exampleMatch[1] : '',
      code: content,
      isNew: false
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get command', 
      message: error.message 
    });
  }
});

// Save a command
app.post('/api/commands', (req, res) => {
  try {
    const { name, title, description, example, code, isNew } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ error: 'Command name and code are required' });
    }
    
    const filePath = path.join(__dirname, 'commands', `${name}.js`);
    
    // Check if command exists and we're not trying to create a new one
    if (!isNew && !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Command not found' });
    }
    
    // Check if we're trying to create a new command but it already exists
    if (isNew && fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'Command already exists' });
    }
    
    // Write the command file
    fs.writeFileSync(filePath, code);
    
    // Reload commands
    try {
      delete require.cache[require.resolve('./commands')];
      const commandHandler = require('./commands');
      commandHandler.loadCommands();
    } catch (error) {
      console.error('Error reloading commands:', error);
    }
    
    res.json({ 
      success: true, 
      name,
      message: `Command ${name} ${isNew ? 'created' : 'updated'} successfully`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to save command', 
      message: error.message 
    });
  }
});

// Delete a command
app.delete('/api/commands/:name', (req, res) => {
  try {
    const { name } = req.params;
    const filePath = path.join(__dirname, 'commands', `${name}.js`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Command not found' });
    }
    
    // Delete the command file
    fs.unlinkSync(filePath);
    
    // Reload commands
    try {
      delete require.cache[require.resolve('./commands')];
      const commandHandler = require('./commands');
      commandHandler.loadCommands();
    } catch (error) {
      console.error('Error reloading commands:', error);
    }
    
    res.json({ 
      success: true, 
      name,
      message: `Command ${name} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete command', 
      message: error.message 
    });
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Send active sessions to the client
  socket.on('getActiveSessions', () => {
    // Debug: Log the active sessions map size
    console.log(`Active sessions count: ${activeSessions.size}`);
    
    // Debug: Log each active session
    activeSessions.forEach((session, id) => {
      console.log(`Session ID: ${id}, Phone: ${session.phoneNumber}, Status: ${session.status}`);
    });
    
    const sessions = Array.from(activeSessions.values()).map(session => ({
      id: session.id,
      phoneNumber: session.phoneNumber,
      name: session.name,
      status: session.status,
      startTime: session.startTime,
      messageCount: session.messageCount
    }));
    
    // Debug: Log the sessions array being sent
    console.log(`Sending ${sessions.length} sessions to client`);
    
    socket.emit('activeSessions', sessions);
  });
  
  // Start a new session
  socket.on('startPairing', async (data) => {
    try {
      const { phoneNumber, sessionName } = data;
      
      // Generate a unique session ID
      const sessionId = uuidv4();
      
      // Start the WhatsApp session
      await startWhatsAppSession(phoneNumber, sessionId, sessionName, true);
    } catch (error) {
      console.error('Error starting session:', error);
      
      socket.emit('sessionStatus', {
        phoneNumber: data.phoneNumber,
        status: 'error',
        message: error.message
      });
    }
  });
  
  // Upload credentials
  socket.on('uploadCredentials', async (data) => {
    try {
      const { phoneNumber, sessionName, credentials } = data;
      
      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }
      
      if (!credentials) {
        throw new Error('Credentials data is required');
      }
      
      // Generate a unique session ID
      const sessionId = uuidv4();
      
      // Clean up phone number format
      const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      
      // Create session directory if it doesn't exist
      const sessionDir = path.join(__dirname, 'sessions', cleanPhoneNumber);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      
      // Ensure credentials is a valid object before stringifying
      let credsData;
      if (typeof credentials === 'string') {
        try {
          credsData = JSON.parse(credentials);
        } catch (e) {
          throw new Error('Invalid JSON credentials format');
        }
      } else {
        credsData = credentials;
      }
      
      // Basic validation of credentials structure
      if (!credsData || typeof credsData !== 'object') {
        throw new Error('Invalid credentials format: not a valid object');
      }
      
      // Write credentials to file
      fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(credsData, null, 2));
      
      console.log(`Credentials saved for ${cleanPhoneNumber}. Starting session...`);
      
      // Start the WhatsApp session with a slight delay to ensure file is written
      setTimeout(async () => {
        try {
          await startWhatsAppSession(cleanPhoneNumber, sessionId, sessionName || cleanPhoneNumber, false);
          
          socket.emit('credentialsUploaded', {
            success: true,
            phoneNumber: cleanPhoneNumber,
            sessionId
          });
        } catch (sessionError) {
          console.error('Error starting session with uploaded credentials:', sessionError);
          
          socket.emit('credentialsUploaded', {
            success: false,
            phoneNumber: cleanPhoneNumber,
            message: `Error starting session: ${sessionError.message}`
          });
        }
      }, 1000);
    } catch (error) {
      console.error('Error uploading credentials:', error);
      
      socket.emit('credentialsUploaded', {
        success: false,
        phoneNumber: data.phoneNumber || 'unknown',
        message: error.message
      });
    }
  });
  
  // Stop a session
  socket.on('stopSession', (sessionId) => {
    try {
      const session = activeSessions.get(sessionId);
      
      if (!session) {
        return socket.emit('error', { message: 'Session not found' });
      }
      
      // Logout and close the connection
      session.socket.logout();
      
      // Remove from active sessions
      activeSessions.delete(sessionId);
      
      // Emit session stopped event
      io.emit('sessionStopped', sessionId);
    } catch (error) {
      console.error('Error stopping session:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Subscribe to logs for a specific session
  socket.on('subscribeLogs', (sessionId) => {
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return socket.emit('error', { message: 'Session not found' });
    }
    
    // Send existing logs
    const logs = session.logStream.logs || [];
    logs.forEach(log => {
      socket.emit('logMessage', {
        sessionId,
        ...log
      });
    });
  });
  
  // Get commands
  socket.on('getCommands', () => {
    try {
      const commandsDir = path.join(__dirname, 'commands');
      
      if (!fs.existsSync(commandsDir)) {
        return socket.emit('commandsList', []);
      }
      
      const commandFiles = fs.readdirSync(commandsDir)
        .filter(file => file.endsWith('.js') && file !== 'index.js');
      
      const commands = commandFiles.map(file => {
        const filePath = path.join(commandsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract command metadata from JSDoc comments
        const nameMatch = content.match(/name:\s*['"](.*?)['"]/);
        const descMatch = content.match(/description:\s*['"](.*?)['"]/);
        
        return {
          name: nameMatch ? nameMatch[1] : file.replace('.js', ''),
          description: descMatch ? descMatch[1] : 'No description available'
        };
      });
      
      socket.emit('commandsList', commands);
    } catch (error) {
      console.error('Error getting commands:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Get a specific command
  socket.on('getCommand', (name) => {
    try {
      const filePath = path.join(__dirname, 'commands', `${name}.js`);
      
      if (!fs.existsSync(filePath)) {
        return socket.emit('error', { message: 'Command not found' });
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract command metadata from JSDoc comments
      const titleMatch = content.match(/title:\s*['"](.*?)['"]/);
      const descMatch = content.match(/description:\s*['"](.*?)['"]/);
      const exampleMatch = content.match(/example:\s*['"](.*?)['"]/);
      
      socket.emit('commandDetails', {
        name,
        title: titleMatch ? titleMatch[1] : '',
        description: descMatch ? descMatch[1] : '',
        example: exampleMatch ? exampleMatch[1] : '',
        code: content,
        isNew: false
      });
    } catch (error) {
      console.error('Error getting command:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Save a command
  socket.on('saveCommand', (command) => {
    try {
      const { name, code, isNew } = command;
      
      if (!name || !code) {
        return socket.emit('error', { message: 'Command name and code are required' });
      }
      
      const filePath = path.join(__dirname, 'commands', `${name}.js`);
      
      // Check if command exists and we're not trying to create a new one
      if (!isNew && !fs.existsSync(filePath)) {
        return socket.emit('error', { message: 'Command not found' });
      }
      
      // Check if we're trying to create a new command but it already exists
      if (isNew && fs.existsSync(filePath)) {
        return socket.emit('error', { message: 'Command already exists' });
      }
      
      // Write the command file
      fs.writeFileSync(filePath, code);
      
      // Reload commands
      try {
        delete require.cache[require.resolve('./commands')];
        const commandHandler = require('./commands');
        commandHandler.loadCommands();
      } catch (error) {
        console.error('Error reloading commands:', error);
      }
      
      socket.emit('commandSaved', { 
        success: true, 
        name,
        message: `Command ${name} ${isNew ? 'created' : 'updated'} successfully`
      });
    } catch (error) {
      console.error('Error saving command:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Delete a command
  socket.on('deleteCommand', (name) => {
    try {
      const filePath = path.join(__dirname, 'commands', `${name}.js`);
      
      if (!fs.existsSync(filePath)) {
        return socket.emit('error', { message: 'Command not found' });
      }
      
      // Delete the command file
      fs.unlinkSync(filePath);
      
      // Reload commands
      try {
        delete require.cache[require.resolve('./commands')];
        const commandHandler = require('./commands');
        commandHandler.loadCommands();
      } catch (error) {
        console.error('Error reloading commands:', error);
      }
      
      socket.emit('commandDeleted', { 
        success: true, 
        name,
        message: `Command ${name} deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting command:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Run system command (supports all commands with security measures)
  socket.on('runSystemCommand', async (data) => {
    try {
      const { command } = data;
      
      // Basic validation and security check
      if (!command || typeof command !== 'string') {
        return socket.emit('commandOutput', { 
          type: 'error', 
          message: 'Invalid command format' 
        });
      }
      
      // Block potentially dangerous commands
      const dangerousPatterns = [
        /rm\s+-rf/i,       // Remove recursively with force
        /format/i,         // Format drives
        /mkfs/i,           // Make filesystem
        /dd\s+if/i,        // Disk destroyer
        /\s+>\s+\/etc\//i, // Redirect to system files
        /chmod\s+777/i     // Unsafe permissions
      ];
      
      const isDangerous = dangerousPatterns.some(pattern => pattern.test(command));
      
      if (isDangerous) {
        return socket.emit('commandOutput', { 
          type: 'error', 
          message: 'This command has been blocked for security reasons.' 
        });
      }
      
      // We've already blocked dangerous commands with pattern matching above
      // Now we'll check if any command is explicitly allowed for better security
      const allowedCommands = [
        // Package managers with auto-yes flags
        'npm install', 'python -m pip', 'pip install', 'choco install', 
        'winget install', 'winget install --id',
        // System commands
        'systeminfo', 'dir', 'tasklist', 'ver', 'echo %PATH%',
        // Network commands
        'ipconfig', 'ping', 'netstat', 'tracert'
      ];
      
      // Check if the command starts with any of the allowed prefixes
      const isAllowed = allowedCommands.some(allowed => command.toLowerCase().startsWith(allowed.toLowerCase()));
      
      if (!isAllowed) {
        // For custom commands, we'll do an additional check for dangerous operations
        const suspiciousPatterns = [
          /del\s+/i,        // Delete files
          /rmdir\s+/i,      // Remove directory
          /shutdown/i,      // Shutdown computer
          /reg\s+/i,        // Registry operations
          /net\s+user/i,    // User account operations
          /taskkill/i       // Kill processes
        ];
        
        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(command));
        
        if (isSuspicious) {
          return socket.emit('commandOutput', { 
            type: 'error', 
            message: 'This command appears to be potentially harmful and has been blocked.' 
          });
        }
      }
      
      // Emit starting message
      socket.emit('commandOutput', { 
        type: 'info', 
        message: `Executing: ${command}` 
      });
      
      // Execute the command
      const { exec } = require('child_process');
      const childProcess = exec(command);
      
      // Stream output in real-time
      childProcess.stdout.on('data', (data) => {
        socket.emit('commandOutput', { 
          type: 'info', 
          message: data.toString() 
        });
      });
      
      childProcess.stderr.on('data', (data) => {
        socket.emit('commandOutput', { 
          type: 'warning', 
          message: data.toString() 
        });
      });
      
      // Handle command completion
      childProcess.on('close', (code) => {
        socket.emit('commandComplete', { 
          success: code === 0, 
          exitCode: code 
        });
      });
      
      childProcess.on('error', (error) => {
        socket.emit('commandOutput', { 
          type: 'error', 
          message: `Error executing command: ${error.message}` 
        });
        
        socket.emit('commandComplete', { 
          success: false, 
          exitCode: 1 
        });
      });
    } catch (error) {
      socket.emit('commandOutput', { 
        type: 'error', 
        message: `Server error: ${error.message}` 
      });
      
      socket.emit('commandComplete', { 
        success: false, 
        exitCode: 1 
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Load existing sessions from the sessions directory
async function loadExistingSessions() {
  // Create a system session ID for general logs
  const systemSessionId = 'system-' + uuidv4().substring(0, 8);
  
  try {
    const sessionsDir = path.join(__dirname, 'sessions');
    
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      sendLog(systemSessionId, 'info', 'Created sessions directory');
      return;
    }
    
    // Get all items in the sessions folder
    const items = fs.readdirSync(sessionsDir, { withFileTypes: true });
    
    // Filter for directories and files
    const sessionDirs = items
      .filter(item => item.isDirectory())
      .map(item => item.name);
    
    // Check for creds.json in the root sessions directory (legacy format)
    const legacyCredsPath = path.join(sessionsDir, 'creds.json');
    const hasLegacyCreds = fs.existsSync(legacyCredsPath);
    
    if (hasLegacyCreds) {
      sendLog(systemSessionId, 'info', 'Found legacy credentials file in sessions directory');
      
      // Create default directory
      const defaultDir = path.join(sessionsDir, 'default');
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }
      
      // Copy legacy creds to default directory
      fs.copyFileSync(legacyCredsPath, path.join(defaultDir, 'creds.json'));
      sendLog(systemSessionId, 'info', 'Migrated legacy credentials to default directory');
      
      // Start session for default - but don't try to validate the credentials file here
      // We'll let the startWhatsAppSession function handle that
      try {
        await startWhatsAppSession('default', uuidv4(), 'Default Session');
      } catch (error) {
        sendLog(systemSessionId, 'error', `Error starting default session: ${error.message}`);
      }
    }
    
    // Get all subdirectories in sessions directory
    const subdirs = fs.readdirSync(sessionsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Load each session
    for (const phoneNumber of subdirs) {
      // Skip the default directory if we already loaded it
      if (phoneNumber === 'default' && hasLegacyCreds) {
        continue;
      }
      
      const sessionDir = path.join(sessionsDir, phoneNumber);
      const credsPath = path.join(sessionDir, 'creds.json');
      
      if (fs.existsSync(credsPath)) {
        try {
          sendLog(systemSessionId, 'info', `Loading existing session for ${phoneNumber}`);
          // Don't try to validate the credentials file here
          // Let the startWhatsAppSession function handle that
          await startWhatsAppSession(phoneNumber, uuidv4(), phoneNumber);
        } catch (error) {
          sendLog(systemSessionId, 'error', `Error starting session for ${phoneNumber}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    sendLog(systemSessionId, 'error', `Error loading existing sessions: ${error}`);
  }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  // Only show minimal startup message
  console.log(`WhatsApp Bot Server running at http://localhost:${PORT}`);
  
  // Load existing sessions
  await loadExistingSessions();
});

// Handle uncaught exceptions
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