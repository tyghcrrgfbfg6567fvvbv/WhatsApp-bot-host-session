
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
      
      // Create assets folder if it doesn't exist
      const assetsDir = path.join(__dirname, '../assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
      }
      
      // Path to the alive image
      const imagePath = path.join(assetsDir, 'alive.jpg');
      
      // Check if image exists, if not we'll use a different approach
      const imageExists = fs.existsSync(imagePath);
      
      // Send the image message with caption
      let sentMessage;
      if (imageExists) {
        // Send the message with the existing image
        const image = fs.readFileSync(imagePath);
        sentMessage = await XeonBotInc.sendMessage(sender, { 
          image: image, 
          caption: caption 
        });
      } else {
        // If image doesn't exist, use a placeholder shadow monarch image
        sentMessage = await XeonBotInc.sendMessage(sender, { 
          image: { url: 'https://i.ibb.co/K0ZSt8M/bot-alive.jpg' },
          caption: caption 
        });
        
        // Inform through console log
        console.log('Using placeholder image. Add an image at assets/alive.jpg for custom image');
      }
      
      // Reply with available commands (without forwarding)
      if (sentMessage) {
        await XeonBotInc.sendMessage(sender, { 
          text: "Type *.system_call* to view the complete command panel with detailed descriptions",
          quoted: sentMessage
        });
      }
      
    } catch (error) {
      console.error('Error in arise command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
