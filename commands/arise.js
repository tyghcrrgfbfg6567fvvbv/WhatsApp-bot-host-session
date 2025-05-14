
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = {
  name: 'arise',
  description: 'Shows that the bot is alive with an image',
  async execute(XeonBotInc, msg) {
    try {
      console.log(chalk.cyan('🤖 EXECUTING ARISE COMMAND'));
      
      // Create assets folder if it doesn't exist
      const assetsDir = path.join(__dirname, '../assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
        console.log(chalk.yellow('📁 Created assets directory'));
      }
      
      // Path to the alive image
      const imagePath = path.join(assetsDir, 'alive.jpg');
      
      // Check if image exists, if not we'll use a different approach
      const imageExists = fs.existsSync(imagePath);
      
      // Message to send
      const caption = "🔥 *The bot is alive* 🔥\n\n*Created by dark hacker*\n\n_Bot is running and ready to serve you_";
      
      // Get the sender's details
      const sender = msg.key.remoteJid;
      const senderName = msg.pushName || 'Unknown';
      
      console.log(chalk.green(`Responding to ${senderName} (${sender})`));
      console.log(chalk.green(`With caption: ${caption}`));
      
      if (imageExists) {
        // Send the message with the image
        console.log(chalk.blue('Using custom image from assets/alive.jpg'));
        const image = fs.readFileSync(imagePath);
        await XeonBotInc.sendMessage(sender, { 
          image: image, 
          caption: caption 
        });
      } else {
        // If image doesn't exist, generate a placeholder image with text
        console.log(chalk.yellow('Using default placeholder image'));
        await XeonBotInc.sendMessage(sender, { 
          image: { url: 'https://i.ibb.co/K0ZSt8M/bot-alive.jpg' },
          caption: caption 
        });
        
        // Inform through console log
        console.log(chalk.yellow('TIP: Add an image at assets/alive.jpg for custom image'));
      }
      
      console.log(chalk.green('✅ Arise command executed successfully'));
      console.log(chalk.gray('─'.repeat(50)));
    } catch (error) {
      console.error(chalk.red('Error in arise command:'), error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
