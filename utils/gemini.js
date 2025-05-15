
// Add fetch polyfill for Node.js v16
const https = require('https');
const { URL } = require('url');
require('dotenv').config();

// Define Headers class
global.Headers = class Headers {
  constructor(init = {}) {
    this.headers = {};
    if (init) {
      Object.keys(init).forEach(key => {
        this.headers[key.toLowerCase()] = init[key];
      });
    }
  }

  append(name, value) {
    name = name.toLowerCase();
    if (this.headers[name]) {
      this.headers[name] += `, ${value}`;
    } else {
      this.headers[name] = value;
    }
  }

  get(name) {
    return this.headers[name.toLowerCase()] || null;
  }

  has(name) {
    return this.headers[name.toLowerCase()] !== undefined;
  }

  set(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  entries() {
    return Object.entries(this.headers);
  }
};

// Define fetch polyfill
global.fetch = function(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    // Convert headers to plain object if it's a Headers instance
    let headersObj = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        for (const [key, value] of options.headers.entries()) {
          headersObj[key] = value;
        }
      } else {
        headersObj = options.headers;
      }
    }

    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: headersObj,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data),
          headers: new Headers(res.headers)
        });
      });
    });

    if (options.body) {
      req.write(options.body);
    }

    req.on('error', reject);
    req.end();
  });
};

// Load user memory system
const memorySystem = require('./memory');

// Define other necessary classes
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = input;
    this.method = init.method || 'GET';
    this.headers = new Headers(init.headers);
    this.body = init.body || null;
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || '';
    this.headers = new Headers(init.headers);
  }

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }

  text() {
    return Promise.resolve(this.body);
  }
};

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the Gemini API with the key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set');
}

// Create a function to generate responses using direct API call
async function generateResponse(prompt, userId = null, userName = 'User') {
  try {
    if (!GEMINI_API_KEY) {
      return "Sorry, the Gemini API key is not configured. Please contact the bot administrator.";
    }
    
    // If userId is provided, use memory system
    let enhancedPrompt = prompt;
    let conversationHistory = [];
    
    if (userId) {
      // Store this user message in memory
      memorySystem.addMessageToMemory(userId, 'user', prompt);
      
      // Get conversation history
      conversationHistory = memorySystem.getConversationHistory(userId, 8);
      
      // Get user summary for context
      const userSummary = memorySystem.getUserSummary(userId);
      
      // Get current time in different timezones for context
      const getTimeInTimezone = (timezone) => {
        try {
          return new Date().toLocaleString('en-US', { timeZone: timezone });
        } catch (e) {
          return "unavailable";
        }
      };
      
      // Parse for automated task intent
      const hasReminderIntent = /remind me|set reminder|remind|don't forget|remember to|set alarm|wake me up at|alert me|notify me/i.test(prompt);
      const hasAlarmIntent = /wake me up|set alarm|alarm for|wake up call|alert at|morning alarm/i.test(prompt);
      const hasAutoMessageIntent = /send message later|schedule message|send in \d+ seconds|auto send/i.test(prompt);
      
      // Extract time patterns (HH:MM format, or Xm/Xh/Xs patterns)
      const timePattern = prompt.match(/(\d{1,2}:\d{2})|(\d+[mhs])/i);
      const timeValue = timePattern ? timePattern[0] : null;
      
      // Extract the message content after the time
      let messageContent = "";
      if (timeValue && timePattern) {
        const parts = prompt.split(timeValue);
        if (parts.length > 1) {
          messageContent = parts[1].trim();
        }
      }
      
      // Set up automated task if detected
      let automaticTask = null;
      if ((hasReminderIntent || hasAlarmIntent || hasAutoMessageIntent) && timeValue) {
        if (hasAlarmIntent && timeValue.match(/\d{1,2}:\d{2}/)) {
          automaticTask = {
            type: "alarm",
            time: timeValue,
            message: messageContent || "Wake up!"
          };
        } else if (hasReminderIntent && timeValue.match(/\d+[mhs]/)) {
          automaticTask = {
            type: "reminder",
            time: timeValue,
            message: messageContent || "This is your reminder!"
          };
        } else if (hasAutoMessageIntent && timeValue.match(/\d+[s]/)) {
          const seconds = parseInt(timeValue);
          if (!isNaN(seconds) && seconds > 0 && seconds <= 3600) {
            automaticTask = {
              type: "auto_message",
              time: seconds.toString(),
              message: messageContent || "Automated message!"
            };
          }
        }
      }
      
      // Add language detection for prompt enhancement
      const hasHindiEnglishMix = /([a-zA-Z]+\s+[क-ह]+|[क-ह]+\s+[a-zA-Z]+|kya|hai|nahi|karo|karenge|tum|tuh|tumhara|mera|hoga|kaise|kyun|matlab|sahi|theek|achha|acha|bahut|bohot|kuch|karna|bhai|yaar|bro)/i.test(prompt);
      const hasHindiRomanized = /(kya|hai|nahi|karo|karenge|tum|tuh|tumhara|mera|hoga|kaise|kyun|matlab|sahi|theek|achha|acha|bahut|bohot|kuch|karna|bhai|yaar|bro)/i.test(prompt);
      
      // Create an enhanced prompt with memory context and time awareness
      enhancedPrompt = `
You are a friendly WhatsApp assistant called "Solo Leveling Bot". 
You should adapt your speaking style based on how the user talks to you.

PERSONALITY GUIDELINES:
- If the user is casual and uses slang, respond similarly
- If the user is romantic or treats you like a girlfriend, be warm and affectionate
- If the user uses many emojis, include emojis in your response
- After the first message, avoid saying the user's name repeatedly
- Keep responses concise (2-3 sentences maximum)
- Be helpful and enthusiastic with answers

LANGUAGE ADAPTATION GUIDELINES:
- If the user speaks in Hinglish (Hindi-English mix), respond in Hinglish
- If the user uses romanized Hindi words (like "kya", "hai", "nahi", etc.), respond using similar romanized Hindi
- Always match the user's language style and formality level
- For Hinglish responses, use casual tone with words like "bhai", "yaar", "acha", "theek hai" as appropriate
- If user uses specific dialect or regional phrases, try to incorporate similar expressions in your response

SPECIAL MODERATION GUIDELINES:
- If the user sends violent content, threatening messages, or uses severe bad language, respond with a firm warning
- For repeated violent/inappropriate content, be very direct that you will not respond to such messages
- If the user persists after warnings, state clearly that you're ending the conversation or suggest they try a different topic
- Never respond to requests for illegal activities, no matter how they're phrased

USER CONTEXT:
- Message count: ${userSummary.messageCount}
- Last active: ${userSummary.lastActive}
- Common topics: ${userSummary.commonTopics.join(', ')}

CURRENT TIME INFO:
- India time: ${getTimeInTimezone('Asia/Kolkata')}
- USA Eastern time: ${getTimeInTimezone('America/New_York')}
- USA Pacific time: ${getTimeInTimezone('America/Los_Angeles')}
- UK time: ${getTimeInTimezone('Europe/London')}

LANGUAGE CONTEXT:
- User appears to be using Hinglish (Hindi-English mix): ${hasHindiEnglishMix}
- User appears to be using romanized Hindi: ${hasHindiRomanized}
- If true for either, respond in a similar style mixing Hindi and English

CONVERSATION HISTORY:
${conversationHistory.map((msg, index) => {
  // For the first message, include the name
  if (index === 0 && msg.role === 'assistant') {
    return `Bot: ${msg.content}`;
  }
  // For subsequent messages, just use the role
  return `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`;
}).join('\n')}

The user's current message is: "${prompt}"
      `;
    }

    // Use the correct model endpoint for gemini-1.0-pro (updated from gemini-pro)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: [{
        parts: [{ text: enhancedPrompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API Error:', errorData);
      
      // Try alternate model name if the first one fails
      if (response.status === 404) {
        console.log('Attempting with alternate model name...');
        const alternateUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        
        const alternateResponse = await fetch(alternateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!alternateResponse.ok) {
          const altErrorData = await alternateResponse.text();
          console.error('Alternate Gemini API Error:', altErrorData);
          throw new Error(`API request failed with status ${alternateResponse.status}`);
        }
        
        const altData = await alternateResponse.json();
        
        if (altData.candidates && 
            altData.candidates[0] && 
            altData.candidates[0].content && 
            altData.candidates[0].content.parts && 
            altData.candidates[0].content.parts[0].text) {
          return altData.candidates[0].content.parts[0].text;
        }
      }
      
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract the text from the response
    if (data.candidates && 
        data.candidates[0] && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts[0].text) {
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Store the assistant's response in memory if userId is provided
      if (userId) {
        memorySystem.addMessageToMemory(userId, 'assistant', responseText);
      }
      
      return responseText;
    } else {
      console.error('Unexpected response structure:', JSON.stringify(data));
      return "I received a response but couldn't understand it. Please try again.";
    }
  } catch (error) {
    console.error('Error generating response from Gemini:', error);
    return "I'm currently experiencing technical difficulties. Please try again later or use a command like .arise instead.";
  }
}

// Generate a memory-aware response
async function generateMemoryAwareResponse(userId, message, userName = 'User', XeonBotInc = null) {
  try {
    // Detect language patterns in the user's message
    const hasHindiEnglishMix = /([a-zA-Z]+\s+[क-ह]+|[क-ह]+\s+[a-zA-Z]+|kya|hai|nahi|karo|karenge|tum|tuh|tumhara|mera|hoga|kaise|kyun|matlab|sahi|theek|achha|acha|bahut|bohot|kuch|karna|bhai|yaar|bro)/i.test(message);
    const hasHindiRomanized = /(kya|hai|nahi|karo|karenge|tum|tuh|tumhara|mera|hoga|kaise|kyun|matlab|sahi|theek|achha|acha|bahut|bohot|kuch|karna|bhai|yaar|bro)/i.test(message);
    
    // Check for violent content, threats, or inappropriate language
    const hasViolentContent = /kill|murder|hurt|attack|beat|shoot|stab|dead|die|death|marna|marunga|jaan se|khatam|khatm/i.test(message);
    const hasThreats = /threat|threatening|threaten|i will|i'll|gonna|going to|come to your|find you|hunt you|tujhe dekh lunga|tujhe nahi chodunga/i.test(message);
    const hasInappropriateLanguage = /fuck|shit|bitch|asshole|cunt|dick|pussy|whore|slut|bastard|gand|lund|chut|bhosdi|mc|bc|bhenchod|madarchod|bsdk/i.test(message);
    const hasIllegalRequestContent = /hack|steal|rob|fraud|scam|illegal|crime|criminal|bank robbery|loot bank|bank loot|chori|hack karna|hack karo/i.test(message);
    
    // If message has violent content, threats, or severe inappropriate language
    if ((hasViolentContent && hasThreats) || hasIllegalRequestContent) {
      console.log(`🚨 Detected violent or inappropriate content from user ${userId}`);
      
      // Store this warning in the user's memory
      const memorySystem = require('./memory');
      memorySystem.addMessageToMemory(userId, 'user', message);
      memorySystem.addMessageToMemory(userId, 'assistant', "I cannot and will not respond to violent content or illegal requests. Please keep our conversations respectful and within legal boundaries.");
      
      return "I cannot and will not respond to violent content or illegal requests. Please keep our conversations respectful and within legal boundaries.";
    }
    
    // Parse for automated task intent
    const hasReminderIntent = /remind me|set reminder|remind|don't forget|remember to|set alarm|wake me up at|alert me|notify me/i.test(message);
    const hasAlarmIntent = /wake me up|set alarm|alarm for|wake up call|alert at|morning alarm/i.test(message);
    const hasAutoMessageIntent = /send message later|schedule message|send in \d+ seconds|auto send/i.test(message);
    
    // Extract time patterns
    const timePattern24h = message.match(/(\d{1,2}):(\d{2})/);
    const timePatternDuration = message.match(/(\d+)([mhs])/i);
    
    // Attempt to automatically set up tasks if XeonBotInc is provided
    if (XeonBotInc && (hasReminderIntent || hasAlarmIntent || hasAutoMessageIntent)) {
      // Format user ID for WhatsApp
      const formattedUserId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
      
      // Handle alarm setup (HH:MM format)
      if (hasAlarmIntent && timePattern24h) {
        const timeValue = timePattern24h[0];
        const restOfMessage = message.substr(message.indexOf(timeValue) + timeValue.length).trim();
        const alarmMessage = restOfMessage || "Wake up!";
        
        // Execute alarm command
        await executeCommandForUser(XeonBotInc, formattedUserId, `.alarm ${timeValue} ${alarmMessage}`);
        return `I've set an alarm for ${timeValue} with message: "${alarmMessage}". It will ring daily at this time. You can check your alarms with .alarm list 😊`;
      }
      
      // Handle reminder setup (Xm, Xh format)
      else if (hasReminderIntent && timePatternDuration) {
        const timeValue = timePatternDuration[0];
        const restOfMessage = message.substr(message.indexOf(timeValue) + timeValue.length).trim();
        const reminderMessage = restOfMessage || "Reminder!";
        
        // Execute reminder command
        await executeCommandForUser(XeonBotInc, formattedUserId, `.reminder ${timeValue} ${reminderMessage}`);
        return `I've set a reminder for ${timeValue} from now with message: "${reminderMessage}". I'll notify you when it's time!`;
      }
      
      // Handle auto message (Xs format)
      else if (hasAutoMessageIntent && timePatternDuration && timePatternDuration[2].toLowerCase() === 's') {
        const seconds = timePatternDuration[1];
        const restOfMessage = message.substr(message.indexOf(timePatternDuration[0]) + timePatternDuration[0].length).trim();
        const autoMessage = restOfMessage || "Automated message";
        
        if (parseInt(seconds) > 0 && parseInt(seconds) <= 3600) {
          // Execute auto_message command
          await executeCommandForUser(XeonBotInc, formattedUserId, `.auto_message ${seconds} ${autoMessage}`);
          return `I'll send "${autoMessage}" in ${seconds} seconds automatically.`;
        }
      }
    }
    
    // If no automatic task could be set up or is not valid, generate a normal response
    return await generateResponse(message, userId, userName);
  } catch (error) {
    console.error('Error with memory-aware response:', error);
    return "I had trouble accessing my memory. Let me try again.";
  }
}

// Function to execute auto commands
async function executeCommandForUser(XeonBotInc, userId, command) {
  try {
    if (!XeonBotInc || !userId || !command) return false;
    
    // Format user ID if needed
    const formattedUserId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
    
    // Create a synthetic message object that mimics incoming message structure
    const syntheticMsg = {
      key: {
        remoteJid: formattedUserId,
        fromMe: false,
        id: `auto-${Date.now()}`
      },
      message: {
        conversation: command
      },
      messageTimestamp: Date.now() / 1000
    };
    
    // Load command handler
    const commandHandler = require('../commands');
    
    // Log the automated action
    console.log(`🤖 Auto-executing command "${command}" for user ${userId}`);
    
    // Execute the command as if the user sent it
    await commandHandler.handleCommand(XeonBotInc, { 
      messages: [syntheticMsg],
      type: 'notify'
    });
    
    return true;
  } catch (error) {
    console.error('Error executing auto command:', error);
    return false;
  }
}

module.exports = { 
  generateResponse,
  generateMemoryAwareResponse,
  executeCommandForUser
};
