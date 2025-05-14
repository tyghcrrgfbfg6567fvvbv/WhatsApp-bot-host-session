
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'shadow',
  description: 'Shows the Shadow Monarch bot status with the exact format',
  async execute(XeonBotInc, msg) {
    try {
      // Get random system stats for immersion
      const storage = 512; // Total storage
      const usedStorage = Math.floor(Math.random() * 300) + 200; // Between 200-500 GB
      const ram = 16; // Total RAM
      const usedRam = (Math.random() * 8 + 2).toFixed(1); // Between 2-10 GB
      const download = (Math.random() * 50 + 50).toFixed(1); // Between 50-100 Mbps
      const upload = (Math.random() * 15 + 10).toFixed(1); // Between 10-25 Mbps
      
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
      
      // Create the status message with exact formatting
      const statusMessage = `⚔️ *ARISE!* ⚔️  
🔥 *The Shadow Monarch's Bot is ONLINE* 🔥  

👤 Developer: Dark Hacker  
🛡️ Mode: System Sentinel Activated  

📊 *System Overview:*  
💾 Storage: ${usedStorage} GB / ${storage} GB  
🧠 RAM: ${usedRam} GB / ${ram} GB  
🌐 Internet:  
   - Download: ${download} Mbps  
   - Upload: ${upload} Mbps  

🕒 Uptime: ${uptimeString}  
📅 Timestamp: ${formattedDate}, ${formattedTime}  

_"I am no longer weak. I am the ruler of shadows."_`;
      
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Send the status message
      await XeonBotInc.sendMessage(sender, { 
        text: statusMessage
      });
      
    } catch (error) {
      console.error('Error in shadow command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
