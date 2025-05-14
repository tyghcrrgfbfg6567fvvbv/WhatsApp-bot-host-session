
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
  // Get the message content
  const msg = m.messages[0];
  if (!msg.message) return;
  
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
};

module.exports = {
  loadCommands,
  handleCommand
};
