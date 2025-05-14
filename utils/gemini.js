
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCy_ZbcdfIvSUuuQVhZ4FW34DAFDEE-iIE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Create a function to generate responses
async function generateResponse(prompt) {
  try {
    // For text-only input, use the gemini-pro model
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating response from Gemini:', error);
    return "I'm having trouble connecting to my brain right now. Please try again later.";
  }
}

module.exports = { generateResponse };
