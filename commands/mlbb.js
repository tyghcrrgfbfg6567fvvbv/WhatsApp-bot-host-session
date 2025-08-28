/**
 * @command
 * name: mlbb
 * category: GAMING
 * title: Mobile Legends: Bang Bang Updates
 * description: Fetches MLBB news, events, updates, redeem codes, hero lists, counter heroes, and server status
 * example: .mlbb news
 * subcommands:
 *   - cmd: news
 *     desc: Fetch latest MLBB news, events, redeem codes, and server status
 *   - cmd: hero list
 *     desc: List all MLBB heroes
 *   - cmd: counter hero <hero>
 *     desc: Get counter heroes for a specified hero
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

require('dotenv').config();

const CACHE_FILE = path.join(__dirname, '../assets/mlbb_cache.json');
const MLBB_URL = 'https://m.mobilelegends.com/en';
const GROUP_JID = process.env.WHATSAPP_GROUP_JID;
const CHANNEL_JID = process.env.WHATSAPP_CHANNEL_JID;

// Static hero list (update periodically)
const HEROES = [
  'Aamon', 'Akai', 'Aldous', 'Alice', 'Alpha', 'Alucard', 'Angela', 'Argus', 'Arlott', 'Atlas',
  'Aulus', 'Aurora', 'Badang', 'Balmond', 'Bane', 'Barats', 'Baxia', 'Beatrix', 'Belerick', 'Benedetta',
  'Brody', 'Bruno', 'Carmilla', 'Cecilion', 'Chang\'e', 'Chou', 'Claude', 'Clint', 'Cyclops', 'Diggie',
  'Dyrroth', 'Edith', 'Esmeralda', 'Estes', 'Eudora', 'Fanny', 'Faramis', 'Floryn', 'Franco', 'Fredrinn',
  'Gatotkaca', 'Gloo', 'Gord', 'Granger', 'Grock', 'Guinevere', 'Gusion', 'Hanabi', 'Hanzo', 'Harley',
  'Hayabusa', 'Helcurt', 'Hilda', 'Hylos', 'Irithel', 'Jawhead', 'Johnson', 'Joy', 'Julian', 'Kadita',
  'Kagura', 'Kaja', 'Karina', 'Karrie', 'Khaleed', 'Khufra', 'Kimmy', 'Lancelot', 'Lapulapu', 'Layla',
  'Leomord', 'Lesley', 'Ling', 'Lolita', 'Lunox', 'Luo Yi', 'Lylia', 'Martis', 'Mathilda', 'Melissa',
  'Minsitthar', 'Miya', 'Moskov', 'Nana', 'Natalia', 'Natan', 'Novaria', 'Odette', 'Paquito', 'Pharsa',
  'Phoveus', 'Popol and Kupa', 'Rafaela', 'Roger', 'Ruby', 'Saber', 'Selena', 'Silvanna', 'Sun', 'Terizla',
  'Thamuz', 'Tigreal', 'Uranus', 'Vale', 'Valentina', 'Valir', 'Vexana', 'Wanwan', 'X.Borg', 'Yi Sun-shin',
  'Yin', 'Yu Zhong', 'Yve', 'Zilong', 'Zhask', 'Zhuangzi', 'Zetian', 'Kalea'
];


const { GoogleGenerativeAI } = require('@google/generative-ai');
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fetch MLBB news, events, updates, redeem codes (no AI)
async function fetchMLBBUpdates() {
  try {
    const { data } = await axios.get(MLBB_URL, { timeout: 10000 });
    const $ = cheerio.load(data);
    const updates = [];
    const redeemCodes = [];

    // Scrape news and events
    $('article, .news-item, .event-item').each((i, el) => {
      const title = $(el).find('h2, .title').text().trim();
      const date = $(el).find('.date, time').text().trim() || new Date().toISOString().split('T')[0];
      const description = $(el).find('p, .desc').text().trim();
      if (title && description) {
        updates.push({ title, date, description });
      }
      // Try to find redeem codes in description
      const codes = description.match(/[A-Z0-9]{6,12}/g);
      if (codes) redeemCodes.push(...codes);
    });

    // Also look for redeem codes anywhere in the page
    const pageCodes = data.match(/[A-Z0-9]{6,12}/g);
    if (pageCodes) {
      pageCodes.forEach(code => {
        if (!redeemCodes.includes(code)) redeemCodes.push(code);
      });
    }

    // Use Gemini API to summarize latest updates
    let summary = '';
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
      for (const modelName of MODELS) {
        try {
          const model = gemini.getGenerativeModel({ model: modelName });
          const prompt = `Summarize the latest Mobile Legends: Bang Bang news, events, and updates from this HTML: ${data.slice(0, 4000)}. List any redeem codes found.`;
          const result = await model.generateContent(prompt);
          if (result && result.response && typeof result.response.text === 'function') {
            summary = result.response.text();
            break;
          }
        } catch (e) {
          // Try next model
        }
      }
    } catch (err) {
      summary = '';
    }
    return { updates, redeemCodes, summary };
  } catch (error) {
    console.error('Error fetching MLBB updates:', error.message);
    return { updates: [], redeemCodes: [] };
  }
}

// Check MLBB server status
async function checkServerStatus() {
  try {
    const start = Date.now();
    await axios.head(MLBB_URL, { timeout: 5000 });
    const ping = Date.now() - start;
    return {
      status: 'Online',
      ping: `${ping} ms`,
      time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
    };
  } catch (error) {
    return {
      status: 'Offline',
      ping: 'N/A',
      time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
    };
  }
}

// Format MLBB message
function formatMLBBMessage(data, type = 'news') {
  let output = '🎮 *MLBB News*\n\n';
  switch (type) {
    case 'news':
      output += '📢 *Latest Updates*\n';
      if (data.summary) {
        output += `${data.summary}\n\n`;
      } else {
        data.updates.slice(0, 3).forEach(u => {
          output += `📰 ${u.title}\n📅 ${u.date}\n${u.description.slice(0, 100)}...\n\n`;
        });
      }
      if (data.redeemCodes && data.redeemCodes.length) {
        output += '🎁 *Redeem Codes*\n' + data.redeemCodes.join('\n') + '\n\n';
      }
      output += '🌐 *Server Status*\n' +
        `Status: ${data.serverStatus.status}\n` +
        `Ping: ${data.serverStatus.ping}\n` +
        `Time: ${data.serverStatus.time}\n`;
      break;
    case 'hero list':
      output += '🦸 *All MLBB Heroes*\n' + HEROES.sort().join(', ') + '\n';
      break;
    case 'counter hero':
      output += `⚔️ *Counter Heroes for ${data.hero}*\n` +
        (data.counters?.length ? data.counters.join(', ') : 'No counters found') + '\n';
      break;
  }
  output += '\nSource: m.mobilelegends.com\nPowered by Dark Hacker';
  return output;
}

// Auto-post updates
async function autoPostUpdates(XeonBotInc) {
  try {
    const cache = await fs.readFile(CACHE_FILE, 'utf8').catch(() => '{}');
    const cacheData = JSON.parse(cache);
    const { updates, redeemCodes } = await fetchMLBBUpdates();

    // Check for new updates
    const newUpdates = updates.filter(u => !cacheData[u.title]);
    if (newUpdates.length || redeemCodes.length) {
      const serverStatus = await checkServerStatus();
      const message = formatMLBBMessage({ updates: newUpdates, redeemCodes, serverStatus }, 'news');

      // Post to group and channel
      if (GROUP_JID) {
        await XeonBotInc.sendMessage(GROUP_JID, { text: message });
        console.log(`Auto-posted to group: ${GROUP_JID}`);
      }
      if (CHANNEL_JID) {
        await XeonBotInc.sendMessage(CHANNEL_JID, { text: message });
        console.log(`Auto-posted to channel: ${CHANNEL_JID}`);
      }

      // Update cache
      newUpdates.forEach(u => cacheData[u.title] = u.date);
      await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData));
    }
  } catch (error) {
    console.error('Error in auto-post:', error.message);
  }
}

module.exports = {
  name: 'mlbb',
  category: 'GAMING',
  description: 'Fetches MLBB news, events, updates, redeem codes, hero lists, counter heroes, and server status',
  async execute({ XeonBotInc, sender, commandArgs, msg }) {
    try {
      // .mlbb see <image_url> - describe the image
      if (commandArgs[0]?.toLowerCase() === 'see' && commandArgs[1]) {
        const imageUrl = commandArgs[1];
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

      // .mlbb tts <text> - reply with TTS (female voice)
      if (commandArgs[0]?.toLowerCase() === 'tts' && commandArgs[1]) {
        const ttsText = commandArgs.slice(1).join(' ');
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

      // If user asks a question (not a subcommand), answer using Gemini
      if (commandArgs.length > 0 && !['news','hero','counter','counter hero','hero list','see','tts'].includes(commandArgs[0].toLowerCase())) {
        const question = commandArgs.join(' ');
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
        let answer = '';
        for (const modelName of MODELS) {
          try {
            const model = gemini.getGenerativeModel({ model: modelName });
            const prompt = `You are an expert on Mobile Legends: Bang Bang and MOBA games. Answer the following question about MLBB or MOBA only: ${question}`;
            const result = await model.generateContent(prompt);
            if (result && result.response && typeof result.response.text === 'function') {
              answer = result.response.text();
              break;
            }
          } catch (e) {
            // Try next model
          }
        }
        await XeonBotInc.sendMessage(sender, { text: answer || '❌ Could not answer your MLBB/MOBA question.' });
        return;
      }

      const subcommand = commandArgs[0]?.toLowerCase() || 'news';
      let response;

      switch (subcommand) {
        case 'news': {
          const { updates, redeemCodes } = await fetchMLBBUpdates();
          const serverStatus = await checkServerStatus();
          response = formatMLBBMessage({ updates, redeemCodes, serverStatus }, 'news');
          break;
        }
        case 'hero': {
          if (commandArgs[1]?.toLowerCase() === 'list') {
            response = formatMLBBMessage({}, 'hero list');
          } else if (commandArgs[1]) {
            const hero = commandArgs.slice(1).join(' ');
            // Use Gemini API to search for counter heroes online
            try {
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
              let counters = [];
              for (const modelName of MODELS) {
                try {
                  const model = gemini.getGenerativeModel({ model: modelName });
                  const prompt = `List the best counter heroes for Mobile Legends hero: ${hero}. Only list hero names, separated by commas.`;
                  const result = await model.generateContent(prompt);
                  if (result && result.response && typeof result.response.text === 'function') {
                    counters = result.response.text().split(/,|\n/).map(h => h.trim()).filter(Boolean);
                    break;
                  }
                } catch (e) {
                  // Try next model
                }
              }
              response = formatMLBBMessage({ hero, counters }, 'counter hero');
            } catch (err) {
              response = `❌ Could not fetch counter heroes for ${hero}.`;
            }
          } else {
            response = '❌ Usage: .mlbb hero list or .mlbb counter hero <hero>';
          }
          break;
        }
        default:
          response = '❌ Invalid subcommand. Use: .mlbb news, .mlbb hero list, .mlbb counter hero <hero> or .mlbb <your MLBB/MOBA question>';
      }

      await XeonBotInc.sendMessage(sender, { text: response });

    } catch (error) {
      console.error('Error in mlbb command:', error.message);
      await XeonBotInc.sendMessage(msg.key.remoteJid, {
        text: '❌ An error occurred: ' + error.message
      });
    }
  },
  autoPost: (XeonBotInc) => setInterval(() => autoPostUpdates(XeonBotInc), 24 * 60 * 60 * 1000) // 24 hours
}