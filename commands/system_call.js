
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'system_call',
  description: 'Display advanced command panel with detailed information',
  async execute(XeonBotInc, msg) {
    try {
      // Get the sender's details
      const sender = msg.key.remoteJid;
      
      // Create enhanced command panel message
      const commandPanel = `🧿 *Shadow Monarch Bot – Command Panel*  
━━━━━━━━━━━━━━━━━━━━━━━

⚔️ \`.arise\`  
🔹 *Summon Status Panel*  
↳ Displays system status: storage, RAM, internet speed, and uptime in Solo Leveling style.

🧠 \`.auto_chat on/off\`  
🔹 *Toggle AI Assistant (Gemini)*  
↳ Enables or disables AI-powered conversations.  
  • \`on\`  – Activate AI  
  • \`off\` – Deactivate AI

🎮 \`.ffinfo <UID> <Region>\`  
🔹 *Fetch Free Fire Player Info*  
↳ Example: \`.ffinfo 123456789 AS\`  
Returns in-game data: level, rank, stats, K/D, and last match history.

🔍 \`.system_call\`  
🔹 *Display Command Panel*  
↳ Shows this advanced command menu with detailed descriptions.

━━━━━━━━━━━━━━━━━━━━━━━  
📌 Developed by *Dark Hacker*`;

      // Path to the command panel image if exists
      const assetsDir = path.join(__dirname, '../assets');
      const imagePath = path.join(assetsDir, 'command_panel.jpg');
      
      // Send message with or without image based on availability
      if (fs.existsSync(imagePath)) {
        const image = fs.readFileSync(imagePath);
        await XeonBotInc.sendMessage(sender, { 
          image: image, 
          caption: commandPanel 
        });
      } else {
        await XeonBotInc.sendMessage(sender, { 
          text: commandPanel 
        });
      }
      
    } catch (error) {
      console.error('Error in system_call command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
