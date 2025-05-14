
const { addMessageToMemory, getUserMemory, cleanupOldMemories } = require('../utils/memory');

module.exports = {
  name: 'memory',
  description: 'View or manage your chat memory',
  async execute(XeonBotInc, msg) {
    try {
      const sender = msg.key.remoteJid;
      const userId = sender.split('@')[0];
      
      // Get the command arguments
      const messageContent = msg.message.conversation || 
                          (msg.message.extendedTextMessage && 
                          msg.message.extendedTextMessage.text) || '';
      
      const args = messageContent.slice(1).trim().split(' ');
      const subCommand = args[1] ? args[1].toLowerCase() : 'status';
      
      switch (subCommand) {
        case 'status':
          // Show memory status
          const memory = getUserMemory(userId);
          const messageCount = memory.messages.length;
          const lastInteraction = memory.lastInteraction ? new Date(memory.lastInteraction).toLocaleString() : 'Never';
          
          let response = `📚 *Memory Status*\n\n`;
          response += `🧠 Messages in memory: ${messageCount}\n`;
          response += `🕒 Last interaction: ${lastInteraction}\n`;
          
          if (memory.userInfo && Object.keys(memory.userInfo).length > 0) {
            response += `\n👤 *Stored User Info*\n`;
            for (const [key, value] of Object.entries(memory.userInfo)) {
              if (key === 'lastSeen') {
                response += `${key}: ${new Date(value).toLocaleString()}\n`;
              } else {
                response += `${key}: ${value}\n`;
              }
            }
          }
          
          await XeonBotInc.sendMessage(sender, { text: response });
          break;
          
        case 'clear':
          // Clear user's memory
          addMessageToMemory(userId, 'system', 'Memory cleared by user request');
          const newMemory = getUserMemory(userId);
          newMemory.messages = [];
          
          await XeonBotInc.sendMessage(sender, { 
            text: `🧹 Your chat memory has been cleared. I'll start building new memories from now on.` 
          });
          break;
          
        case 'remember':
          // Add specific memory
          const memoryText = args.slice(2).join(' ');
          if (!memoryText) {
            await XeonBotInc.sendMessage(sender, { 
              text: `❌ Please specify something to remember (Example: .memory remember I like anime)` 
            });
            return;
          }
          
          addMessageToMemory(userId, 'user', `Please remember that ${memoryText}`);
          addMessageToMemory(userId, 'assistant', `I'll remember that ${memoryText}`);
          
          await XeonBotInc.sendMessage(sender, { 
            text: `✅ I'll remember that ${memoryText}` 
          });
          break;
          
        case 'help':
          // Show help message
          let helpText = `🧠 *Memory Command Help*\n\n`;
          helpText += `• \`.memory status\` - View your memory status\n`;
          helpText += `• \`.memory clear\` - Clear your chat history\n`;
          helpText += `• \`.memory remember [text]\` - Make the bot remember something\n`;
          helpText += `• \`.memory help\` - Show this help message`;
          
          await XeonBotInc.sendMessage(sender, { text: helpText });
          break;
          
        default:
          await XeonBotInc.sendMessage(sender, { 
            text: `❌ Unknown memory command. Try \`.memory help\` for available options.` 
          });
      }
      
    } catch (error) {
      console.error('Error in memory command:', error);
      const sender = msg.key.remoteJid;
      await XeonBotInc.sendMessage(sender, { 
        text: "❌ An error occurred while processing your memory command." 
      });
    }
  }
};
