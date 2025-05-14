
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'owner',
  description: 'Owner-only command that returns bot status',
  async execute(XeonBotInc, msg) {
    try {
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Check if sender is the owner
      if (!msg.isOwner) {
        await XeonBotInc.sendMessage(sender, { 
          text: "❌ This command can only be used by the bot owner." 
        });
        return;
      }
      
      // This part will only execute if sender is the owner
      const ownerMessage = `🔐 *Owner Command Executed*\n
📊 *Bot Status Information*
━━━━━━━━━━━━━━━━━━
• 🔋 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• ⏱️ Uptime: ${Math.floor(process.uptime() / 3600)} hours, ${Math.floor((process.uptime() % 3600) / 60)} minutes
• 👥 Connected Chats: Active
• 🛡️ Permission Level: Administrator
━━━━━━━━━━━━━━━━━━
✅ *All systems operational*`;
      
      await XeonBotInc.sendMessage(sender, { 
        text: ownerMessage 
      });
      
    } catch (error) {
      console.error('Error in owner command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { 
        text: 'An error occurred while processing the command.' 
      });
    }
  },
};
