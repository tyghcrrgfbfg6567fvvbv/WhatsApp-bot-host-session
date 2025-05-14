
const fetch = global.fetch || require('node-fetch');

module.exports = {
  name: 'ffinfo',
  description: 'Get Free Fire account information by UID and region',
  async execute(XeonBotInc, msg) {
    try {
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Get the command arguments
      const messageContent = msg.message.conversation || 
                          (msg.message.extendedTextMessage && 
                          msg.message.extendedTextMessage.text) || '';
      
      const args = messageContent.slice(1).trim().split(' ');
      
      if (args.length < 3) {
        await XeonBotInc.sendMessage(sender, { 
          text: "❌ Please provide UID and region (Example: .ffinfo 123456789 NA)" 
        });
        return;
      }
      
      const uid = args[1];
      const region = args[2];
      
      // Show typing indicator
      await XeonBotInc.sendPresenceUpdate('composing', sender);
      
      // Fetch data from API
      const response = await fetch(`https://brokenplay23-ff-info.onrender.com/api/account?uid=${uid}&region=${region}`);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format the response
      if (data.error) {
        await XeonBotInc.sendMessage(sender, { 
          text: `❌ Error: ${data.error}` 
        });
        return;
      }
      
      // Create a formatted message with the account information
      const formattedMessage = `🎮 *FREE FIRE ACCOUNT INFO* 🎮\n\n` +
                              `🆔 *UID:* ${data.uid || uid}\n` +
                              `🌍 *Region:* ${data.region || region}\n` +
                              `👤 *Username:* ${data.username || 'N/A'}\n` +
                              `👑 *Level:* ${data.level || 'N/A'}\n` +
                              `🏆 *Rank:* ${data.rank || 'N/A'}\n` +
                              `📊 *Stats:*\n` +
                              `   - K/D Ratio: ${data.kd || 'N/A'}\n` +
                              `   - Win Rate: ${data.winRate || 'N/A'}\n` +
                              `   - Matches: ${data.matches || 'N/A'}\n\n` +
                              `💎 *Account Value:* ${data.accountValue || 'N/A'}\n` +
                              `⏰ *Last Online:* ${data.lastOnline || 'N/A'}\n\n` +
                              `_Powered by Shadow Monarch Bot_`;
      
      // Send the formatted message
      await XeonBotInc.sendMessage(sender, { 
        text: formattedMessage 
      });
      
    } catch (error) {
      console.error('Error in ffinfo command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { 
        text: '❌ An error occurred while fetching the account information. Please check the UID and region are correct.'
      });
    }
  },
};
