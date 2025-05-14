
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
      let rateLimitedCount = 0;
      
      // Helper function for delay
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      
      // Disable disappearing messages in each chat with rate limiting
      for (const [jid, chat] of Object.entries(chats)) {
        try {
          // Add delay to prevent rate limiting (increasing delay for each request)
          await delay(1000 + (200 * rateLimitedCount));
          
          // Attempt to disable disappearing messages (0 = off)
          await XeonBotInc.sendMessage(jid, { disappearingMessagesInChat: 0 });
          successCount++;
          
          // Reset rate limit counter after successful operations
          rateLimitedCount = Math.max(0, rateLimitedCount - 1);
        } catch (err) {
          // Check if it's a rate limit error
          if (err.data === 429 || (err.message && err.message.includes('rate-overlimit'))) {
            console.log(`Rate limited for ${jid}, will retry with increased delay`);
            rateLimitedCount++;
            
            // Add significant delay before retrying this specific chat
            await delay(3000 * rateLimitedCount);
            
            try {
              // Retry with increased delay
              await XeonBotInc.sendMessage(jid, { disappearingMessagesInChat: 0 });
              successCount++;
            } catch (retryErr) {
              console.error(`Error after retry for ${jid}:`, retryErr);
              errorCount++;
            }
          } else {
            console.error(`Error disabling timer in ${jid}:`, err);
            errorCount++;
          }
        }
        
        // Pause between each chat regardless of outcome
        await delay(500);
      }
      
      // Also try for the current chat specifically
      try {
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
