const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Initialize the Gemini API with the key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set');
}

/**
 * Generate a response using Gemini API via curl
 * @param {string} prompt - The prompt text to send to Gemini
 * @returns {Promise<string>} - The response from Gemini
 */
async function generateResponse(prompt) {
  try {
    if (!GEMINI_API_KEY) {
      return "Sorry, the Gemini API key is not configured. Please contact the bot administrator.";
    }

    // Create the request body
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    };

    // Escape the JSON for shell command
    const escapedBody = JSON.stringify(requestBody).replace(/"/g, '\\"');

    // Execute curl command
    const curlCommand = `curl -s -X POST "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "${escapedBody}"`;

    console.log('Executing curl command for Gemini API...');
    const { stdout, stderr } = await execPromise(curlCommand);

    if (stderr) {
      console.error('Curl stderr:', stderr);
    }

    // Parse the response
    const data = JSON.parse(stdout);

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