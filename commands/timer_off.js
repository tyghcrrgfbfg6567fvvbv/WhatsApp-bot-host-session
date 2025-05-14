
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'timer_off',
  description: 'Disable disappearing messages in all chats',
  async execute(XeonBotInc, msg) {
    try {
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Show typing indicator
      await XeonBotInc.sendPresenceUpdate('composing', sender);
      
      // Send initial response
      await XeonBotInc.sendMessage(sender, { 
        text: "🕒 *Disabling message timers...*\nThis process may take a moment." 
      });
      
      // Get all chats
      const chats = await XeonBotInc.groupFetchAllParticipating();
      let successCount = 0;
      let errorCount = 0;
      
      // Disable disappearing messages in each chat
      for (const [jid, chat] of Object.entries(chats)) {
        try {
          // Attempt to disable disappearing messages (0 = off)
          await XeonBotInc.sendMessage(jid, { disappearingMessagesInChat: 0 });
          successCount++;
        } catch (err) {
          console.error(`Error disabling timer in ${jid}:`, err);
          errorCount++;
        }
      }
      
      // Also try for individual chats
      try {
        // Disable for the current chat specifically
        await XeonBotInc.sendMessage(sender, { disappearingMessagesInChat: 0 });
      } catch (chatErr) {
        console.error("Error disabling in current chat:", chatErr);
      }
      
      // Send completion message
      await XeonBotInc.sendMessage(sender, { 
        text: `✅ *Message Timer Status*\n\n` +
              `Message timers have been disabled in ${successCount} chats.\n` +
              `${errorCount > 0 ? `Failed in ${errorCount} chats.\n` : ''}` +
              `\n_Note: This command only affects chats where the bot has admin privileges._`
      });
      
    } catch (error) {
      console.error('Error in timer_off command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { 
        text: '❌ An error occurred while processing the command.' 
      });
    }
  },
};
