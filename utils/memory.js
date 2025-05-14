
const fs = require('fs');
const path = require('path');

// Initialize memory storage
let userMemories = {};
const MEMORY_FILE = path.join(__dirname, '../data/user_memories.json');

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load memories from file
function loadMemories() {
  ensureDataDir();
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      userMemories = JSON.parse(data);
      console.log(`Loaded memories for ${Object.keys(userMemories).length} users`);
    } else {
      userMemories = {};
      saveMemories(); // Create the file
    }
  } catch (error) {
    console.error('Error loading memories:', error);
    userMemories = {};
  }
}

// Save memories to file
function saveMemories() {
  ensureDataDir();
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(userMemories, null, 2));
  } catch (error) {
    console.error('Error saving memories:', error);
  }
}

// Add message to user memory
function addMessageToMemory(userId, role, content, timestamp = Date.now()) {
  // Initialize user memory if it doesn't exist
  if (!userMemories[userId]) {
    userMemories[userId] = {
      messages: [],
      userInfo: {},
      lastInteraction: timestamp
    };
  }
  
  // Add message to memory with timestamp
  userMemories[userId].messages.push({
    role,
    content,
    timestamp
  });
  
  // Keep only the last 50 messages per user to avoid memory bloat
  if (userMemories[userId].messages.length > 50) {
    userMemories[userId].messages = userMemories[userId].messages.slice(-50);
  }
  
  // Update last interaction time
  userMemories[userId].lastInteraction = timestamp;
  
  // Save after each update
  saveMemories();
}

// Get user memory
function getUserMemory(userId) {
  return userMemories[userId] || { messages: [], userInfo: {}, lastInteraction: 0 };
}

// Update user information
function updateUserInfo(userId, info) {
  if (!userMemories[userId]) {
    userMemories[userId] = {
      messages: [],
      userInfo: {},
      lastInteraction: Date.now()
    };
  }
  
  userMemories[userId].userInfo = {
    ...userMemories[userId].userInfo,
    ...info
  };
  
  saveMemories();
}

// Get conversation history in a format suitable for AI
function getConversationHistory(userId, maxMessages = 10) {
  const memory = getUserMemory(userId);
  let history = memory.messages.slice(-maxMessages);
  
  return history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
}

// Generate a summary of key information about the user
function getUserSummary(userId) {
  const memory = getUserMemory(userId);
  
  // Extract user info
  const userInfo = memory.userInfo;
  const messageCount = memory.messages.length;
  const lastActive = memory.lastInteraction ? new Date(memory.lastInteraction).toLocaleString() : 'Never';
  
  // Find common topics or patterns (simplified)
  let topics = new Set();
  memory.messages.forEach(msg => {
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();
      if (content.includes('help')) topics.add('assistance');
      if (content.includes('thank')) topics.add('gratitude');
      if (content.includes('how') || content.includes('what') || content.includes('why')) topics.add('questions');
      // Add more pattern detection as needed
    }
  });
  
  return {
    messageCount,
    lastActive,
    userInfo,
    commonTopics: Array.from(topics),
  };
}

// Clean up old memories (optional, can be called periodically)
function cleanupOldMemories(daysThreshold = 30) {
  const threshold = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
  let count = 0;
  
  for (const userId in userMemories) {
    if (userMemories[userId].lastInteraction < threshold) {
      delete userMemories[userId];
      count++;
    }
  }
  
  if (count > 0) {
    console.log(`Cleaned up memories for ${count} inactive users`);
    saveMemories();
  }
  
  return count;
}

// Initialize by loading existing memories
loadMemories();

module.exports = {
  addMessageToMemory,
  getUserMemory,
  updateUserInfo,
  getConversationHistory,
  getUserSummary,
  cleanupOldMemories,
  saveMemories
};
