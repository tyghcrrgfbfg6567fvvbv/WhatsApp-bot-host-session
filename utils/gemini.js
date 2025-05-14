
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
    
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers ? Object.fromEntries(options.headers.entries()) : {},
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
async function generateResponse(prompt) {
  try {
    if (!GEMINI_API_KEY) {
      return "Sorry, the Gemini API key is not configured. Please contact the bot administrator.";
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
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
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract the text from the response
    if (data.candidates && 
        data.candidates[0] && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.error('Unexpected response structure:', JSON.stringify(data));
      return "I received a response but couldn't understand it. Please try again.";
    }
  } catch (error) {
    console.error('Error generating response from Gemini:', error);
    return "I'm having trouble connecting to my brain right now. Please try again later.";
  }
}

module.exports = { generateResponse };
