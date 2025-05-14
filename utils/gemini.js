
// Add fetch polyfill for Node.js v16
const https = require('https');
const { URL } = require('url');

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
      
      // Create an enhanced prompt with memory context
      enhancedPrompt = `
You are a friendly WhatsApp assistant called "Solo Leveling Bot". 
Keep your responses concise (max 3 sentences).

USER CONTEXT:
- Name: ${userName}
- Message count: ${userSummary.messageCount}
- Last active: ${userSummary.lastActive}
- Common topics: ${userSummary.commonTopics.join(', ')}

CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role === 'user' ? userName : 'Bot'}: ${msg.content}`).join('\n')}

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
async function generateMemoryAwareResponse(userId, message, userName = 'User') {
  try {
    return await generateResponse(message, userId, userName);
  } catch (error) {
    console.error('Error with memory-aware response:', error);
    return "I had trouble accessing my memory. Let me try again.";
  }
}

module.exports = { 
  generateResponse,
  generateMemoryAwareResponse
};
