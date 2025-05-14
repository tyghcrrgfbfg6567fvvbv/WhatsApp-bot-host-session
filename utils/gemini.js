
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
