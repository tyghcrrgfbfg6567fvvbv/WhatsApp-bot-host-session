/**
 * @command
 * name: auto_chat
 * title: AI Assistant Toggle
 * description: Toggle AI-powered chat assistant
 * example: .auto_chat on/off
 * subcommands:
 *   - cmd: on
 *     desc: Activate AI
 *   - cmd: off
 *     desc: Deactivate AI
 */



const fs = require('fs');
const path = require('path');
const { generateResponse } = require('../utils/gemini');

// Path to store auto-chat settings
const settingsPath = path.join(__dirname, '../settings.json');

// Initialize settings if they don't exist
const initSettings = () => {
  if (!fs.existsSync(settingsPath)) {
    const defaultSettings = { 
      auto_chat: false,
      auto_chat_users: {}
    };
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
};

// Save settings to file
const saveSettings = (settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
};

module.exports = {
  name: 'auto_chat',
  description: 'Turn auto chat on or off',
  async execute(XeonBotInc, msg) {
    try {
      const settings = initSettings();
      const sender = msg.key.remoteJid;
      
      // Get the command arguments (on/off)
      const messageContent = msg.message.conversation || 
                          (msg.message.extendedTextMessage && 
                          msg.message.extendedTextMessage.text) || '';
      
      const args = messageContent.slice(1).trim().split(' ');
      
      if (args.length < 2) {
        await XeonBotInc.sendMessage(sender, { 
          text: "❌ Please specify 'on' or 'off' (Example: .auto_chat on)" 
        });
        return;
      }
      
      const option = args[1].toLowerCase();
      
      if (option === 'on') {
        settings.auto_chat = true;
        saveSettings(settings);
        await XeonBotInc.sendMessage(sender, { 
          text: "✅ Auto chat has been turned ON. Bot will automatically reply to messages using Gemini AI." 
        });
      } else if (option === 'off') {
        settings.auto_chat = false;
        saveSettings(settings);
        await XeonBotInc.sendMessage(sender, { 
          text: "❌ Auto chat has been turned OFF. Bot will no longer automatically reply to messages." 
        });
      } else {
        await XeonBotInc.sendMessage(sender, { 
          text: "❌ Invalid option. Please use 'on' or 'off' (Example: .auto_chat on)" 
        });
      }
      
    } catch (error) {
      console.error('Error in auto_chat command:', error);
      await XeonBotInc.sendMessage(msg.key.remoteJid, { text: 'An error occurred while processing the command.' });
    }
  },
};
