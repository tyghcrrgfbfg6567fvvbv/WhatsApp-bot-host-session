
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
  name: 'restart',
  description: 'Restart the bot (owner only)',
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
      
      // Send confirmation message
      await XeonBotInc.sendMessage(sender, { 
        text: "🔄 *Restarting bot...*\n\nThe bot will be back online shortly." 
      });
      
      console.log("Restart command executed by owner");
      
      // Use setTimeout to allow the message to be sent before restarting
      setTimeout(() => {
        // This will restart the bot by exiting the process
        // The workflow in Replit will automatically restart it
        process.exit(0);
      }, 2000);
      
    } catch (error) {
      console.error('Error in restart command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { 
        text: 'An error occurred while processing the restart command.' 
      });
    }
  },
};
