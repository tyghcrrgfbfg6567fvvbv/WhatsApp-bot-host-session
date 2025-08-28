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



const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const HISTORY_FILE = path.join(__dirname, '../assets/auto_chat_history.json');
const DEFAULT_NAME = 'GitHub Copilot';
let aiName = DEFAULT_NAME;
let autoChatEnabled = true;
const geminiApiKey = process.env.GEMINI_API_KEY;
const gemini = new GoogleGenerativeAI(geminiApiKey);
const MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-native-audio',
  'gemini-2.5-flash-image-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-embedding',
  'gemma-3',
  'gemma-3n',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

/**
 * Save chat history to a file
 * @param {Object} entry - The chat entry to save
 */
async function saveHistory(entry) {
  let history = [];
  try {
    history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8'));
  } catch {}
  history.push(entry);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Get chat history from the file
 * @returns {Promise<Object[]>} - The chat history
 */
async function getHistory() {
  try {
    return JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Get a reply from Gemini AI models
 * @param {string} prompt - The prompt to send to the AI
 * @returns {Promise<string>} - The AI's reply
 */
async function getGeminiReply(prompt) {
  for (const modelName of MODELS) {
    try {
      const model = gemini.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      if (result && result.response && typeof result.response.text === 'function') {
        return result.response.text();
      }
    } catch (e) {
      // Try next model
    }
  }
  return "Sorry, all Gemini free-tier models are currently unavailable.";
}

module.exports = {
  name: 'auto_chat',
  category: 'AI',
  description: 'Advanced AI chat agent. Toggle with .auto_chat on/off. Responds to AI-related prompts.',
  async execute(XeonBotInc, msg, args) {
    const sender = msg.key.remoteJid;
    let text = '';
    if (msg.message?.conversation) text = msg.message.conversation.trim();
    else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text.trim();

    const lowerText = text.toLowerCase();

    // Toggle auto chat on/off
    if (lowerText === 'auto_chat on' || lowerText === '.auto_chat on') {
      autoChatEnabled = true;
      await XeonBotInc.sendMessage(sender, { text: '✅ Auto chat enabled. AI will respond to your prompts.' });
      return;
    }
    if (lowerText === 'auto_chat off' || lowerText === '.auto_chat off') {
      autoChatEnabled = false;
      await XeonBotInc.sendMessage(sender, { text: '❌ Auto chat disabled. AI will not respond.' });
      return;
    }

 // .see <image_url> - describe the image
    if (args && args[0]?.toLowerCase() === 'see' && args[1]) {
      const imageUrl = args[1];
      const MODELS = [
        'gemini-2.5-flash-image-preview',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ];
      let description = '';
      for (const modelName of MODELS) {
        try {
          const model = gemini.getGenerativeModel({ model: modelName });
          const prompt = `Describe this image for MLBB/MOBA context: ${imageUrl}`;
          const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: imageUrl } }] }] });
          if (result && result.response && typeof result.response.text === 'function') {
            description = result.response.text();
            break;
          }
        } catch (e) {
          // Try next model
        }
      }
      await XeonBotInc.sendMessage(sender, { text: description || '❌ Could not describe the image.' });
      return;
    }

    // .tts <text> - reply with TTS (female voice)
    if (args && args[0]?.toLowerCase() === 'tts' && args[1]) {
      const ttsText = args.slice(1).join(' ');
      const MODELS = [
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-pro-preview-tts'
      ];
      let audioUrl = '';
      for (const modelName of MODELS) {
        try {
          const model = gemini.getGenerativeModel({ model: modelName });
          const prompt = `Speak this in a friendly female voice: ${ttsText}`;
          const result = await model.generateContent(prompt);
          if (result && result.response && result.response.audioUrl) {
            audioUrl = result.response.audioUrl;
            break;
          }
        } catch (e) {
          // Try next model
        }
      }
      if (audioUrl) {
        await XeonBotInc.sendMessage(sender, { audio: { url: audioUrl }, mimetype: 'audio/mp3' });
      } else {
        await XeonBotInc.sendMessage(sender, { text: '❌ Could not generate TTS audio.' });
      }
      return;
    }
    const renameMatch = lowerText.match(/^rename ai to (.+)$/);
    if (renameMatch) {
      aiName = renameMatch[1].trim();
      await saveHistory({ type: 'rename', name: aiName, sender, time: Date.now() });
      await XeonBotInc.sendMessage(sender, { text: `AI renamed to ${aiName}` });
      return;
    }

    // Show history
    if (lowerText === 'show ai history') {
      const history = await getHistory();
      const formatted = history.map((h, i) => `${i + 1}. [${h.type}] ${h.sender}: ${h.text || h.name || ''}`).join('\n');
      await XeonBotInc.sendMessage(sender, { text: formatted || 'No history yet.' });
      return;
    }

    // Respond only if auto chat is enabled
    if (!autoChatEnabled) return;

    // Advanced AI agent: respond to any message containing 'ai', 'copilot', or starting with 'ask ai:'
    if (
      lowerText.includes('ai') ||
      lowerText.includes('copilot') ||
      lowerText.startsWith('ask ai:') ||
      lowerText === 'hello ai' ||
      lowerText === 'hi ai' ||
      lowerText.endsWith(' ai')
    ) {
      await saveHistory({ type: 'user', text, sender, time: Date.now() });
      const prompt = `You are ${aiName}, an advanced AI agent. Reply to: "${text}". Use context from previous messages if needed. Be helpful, concise, and friendly.`;
      const reply = await getGeminiReply(prompt);
      await XeonBotInc.sendMessage(sender, { text: reply });
      await saveHistory({ type: 'ai', text: reply, sender, time: Date.now() });
      return;
    }
    // Ignore other messages
  }
};
