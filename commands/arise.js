
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  name: 'arise',
  description: 'Shows that the bot is alive with Shadow Monarch theme',
  async execute(XeonBotInc, msg) {
    try {
      // Get system stats for display
      const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024));
      const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024));
      const usedMemory = (totalMemory - freeMemory).toFixed(1);
      
      // Calculate fake storage stats for display
      const totalStorage = 512;
      const usedStorage = Math.floor(Math.random() * 300) + 200;
      
      // Generate random internet speeds
      const downloadSpeed = (Math.random() * 50 + 50).toFixed(1);
      const uploadSpeed = (Math.random() * 15 + 10).toFixed(1);
      
      // Calculate uptime
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
      
      // Get current timestamp
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const formattedTime = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // The new Shadow Monarch style message
      const caption = `⚔️ *ARISE!* ⚔️  
🔥 *The Shadow Monarch's Bot is ONLINE* 🔥  

👤 Developer: Dark Hacker  
🛡️ Mode: System Sentinel Activated  

📊 *System Overview:*  
💾 Storage: ${usedStorage} GB / ${totalStorage} GB  
🧠 RAM: ${usedMemory} GB / ${totalMemory} GB  
🌐 Internet:  
   - Download: ${downloadSpeed} Mbps  
   - Upload: ${uploadSpeed} Mbps  

🕒 Uptime: ${uptimeString}  
📅 Timestamp: ${formattedDate}, ${formattedTime}  

_"I am no longer weak. I am the ruler of shadows."_`;
      
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Send the text message
      const sentMessage = await XeonBotInc.sendMessage(sender, { 
        text: caption
      });
      
      // Reply with available commands (without forwarding)
      if (sentMessage) {
        await XeonBotInc.sendMessage(sender, { 
          text: "Available Commands:\n• .arise - Show Shadow Monarch status\n• .auto_chat on/off - Enable/disable AI-powered chat using Gemini\n• .shadow - Show Shadow Monarch themed status",
          quoted: sentMessage
        });
      }
      
    } catch (error) {
      console.error('Error in arise command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
