
const fs = require('fs');
const path = require('path');

// Command collection
const commands = new Map();

// Load all command files
const loadCommands = () => {
  const commandFiles = fs.readdirSync(path.join(__dirname))
    .filter(file => file.endsWith('.js') && file !== 'index.js');

  for (const file of commandFiles) {
    const command = require(path.join(__dirname, file));
    commands.set(command.name, command);
    console.log(`Loaded command: ${command.name}`);
  }

  console.log(`Loaded ${commands.size} commands successfully!`);
  return commands;
};

// Handle incoming messages
const handleCommand = async (XeonBotInc, m) => {
  try {
    if (!m.messages || m.messages.length === 0) return;

    const msg = m.messages[0];
    if (msg.key.fromMe || !msg.message) return; // Skip messages from self

    // Check if message is from owner
    const isOwner = (jid) => {
      try {
        const settingsPath = path.join(__dirname, '../settings.json');
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          return jid.includes(settings.owner);
        }
        return jid.includes('918822308081'); // Fallback to hardcoded owner
      } catch (error) {
        console.error("Error checking owner status:", error);
        return false;
      }
    };

    // Set flag to check owner status in commands
    msg.isOwner = isOwner(msg.key.remoteJid);
    
    // Log whether message is from owner
    if (msg.isOwner) {
      console.log(`Message from owner detected: ${msg.key.remoteJid}`);
    }

    // Get the message content
    const messageContent = msg.message.conversation || 
                           (msg.message.extendedTextMessage && 
                            msg.message.extendedTextMessage.text) || '';

    // Check if message starts with a command prefix
    if (!messageContent.startsWith('.')) return;

    // Extract command name
    const commandName = messageContent.slice(1).trim().split(' ')[0].toLowerCase();

    // Find and execute the command
    const command = commands.get(commandName);
    if (command) {
      try {
        await command.execute(XeonBotInc, msg);
        console.log(`Executed command: ${commandName}`);
      } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in command handler:', error);
  }
};

module.exports = {
  loadCommands,
  handleCommand
};
