
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'arise',
  description: 'Shows that the bot is alive with an image',
  async execute(XeonBotInc, msg) {
    try {
      // Create assets folder if it doesn't exist
      const assetsDir = path.join(__dirname, '../assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
      }
      
      // Path to the alive image
      const imagePath = path.join(assetsDir, 'alive.jpg');
      
      // Check if image exists, if not we'll use a different approach
      const imageExists = fs.existsSync(imagePath);
      
      // Message to send
      const caption = "🔥 *The bot is alive* 🔥\n\n*Created by dark hacker*\n\n_Bot is running and ready to serve you_";
      
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Send the image message
      let sentMessage;
      if (imageExists) {
        // Send the message with the image
        const image = fs.readFileSync(imagePath);
        sentMessage = await XeonBotInc.sendMessage(sender, { 
          image: image, 
          caption: caption 
        });
      } else {
        // If image doesn't exist, generate a placeholder image with text
        sentMessage = await XeonBotInc.sendMessage(sender, { 
          image: { url: 'https://i.ibb.co/K0ZSt8M/bot-alive.jpg' },
          caption: caption 
        });
        
        // Inform through console log
        console.log('Using placeholder image. Add an image at assets/alive.jpg for custom image');
      }
      
      // Reply with the welcome message (without forwarding)
      if (sentMessage) {
        await XeonBotInc.sendMessage(sender, { 
          text: "Welcome to Solo leveling Bot.\n\n*Available Commands:*\n• .arise - Show bot status\n• .auto_chat on/off - Enable/disable auto replies",
          quoted: sentMessage
        });
      }
      
    } catch (error) {
      console.error('Error in arise command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
