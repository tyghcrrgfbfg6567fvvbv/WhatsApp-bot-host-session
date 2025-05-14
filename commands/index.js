
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
                          msg.message.extendedTextMessage.text) || 
                         (msg.message.imageMessage && 
                          msg.message.imageMessage.caption) || '';
  
  // Check if message starts with a command prefix
  if (!messageContent.startsWith('.')) return;
  
  // Extract command name and arguments
  const args = messageContent.slice(1).trim().split(' ');
  const commandName = args.shift().toLowerCase();
  
  // Get sender info
  const sender = msg.key.remoteJid;
  const senderName = msg.pushName || 'Unknown';
  
  // Find and execute the command
  const command = commands.get(commandName);
  if (command) {
    try {
      console.log(chalk.cyan(`🔄 COMMAND DETECTED: .${commandName}`));
      console.log(chalk.blue(`From: ${senderName} (${sender})`));
      console.log(chalk.yellow(`Arguments: ${args.join(' ') || 'none'}`));
      
      await command.execute(XeonBotInc, msg);
      
      console.log(chalk.green(`✅ Command executed: ${commandName}`));
    } catch (error) {
      console.error(chalk.red(`❌ Error executing command ${commandName}:`), error);
      // Attempt to notify user of error
      try {
        await XeonBotInc.sendMessage(sender, { 
          text: `Error executing command: ${commandName}\nPlease try again later.` 
        });
      } catch (notifyError) {
        console.error(chalk.red('Failed to notify user of error:'), notifyError);
      }
    }
  } else if (commandName) {
    console.log(chalk.yellow(`⚠️ Unknown command attempted: ${commandName}`));
  }
};

module.exports = {
  loadCommands,
  handleCommand
};
