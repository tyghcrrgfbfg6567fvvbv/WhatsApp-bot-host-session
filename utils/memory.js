const fs = require('fs');
const path = require('path');

// Path to the user memories file
const MEMORY_FILE = path.join(__dirname, '../data/user_memories.json');

// Initialize user memories
function initUserMemories() {
  try {
    // Create the data directory if it doesn't exist
    const dataDir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create the memory file if it doesn't exist
    if (!fs.existsSync(MEMORY_FILE)) {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify([]));
      return [];
    }

    // Read and parse the memory file
    const data = fs.readFileSync(MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(data);

    // Ensure parsed data is an array
    if (!Array.isArray(parsed)) {
      console.warn('Invalid memory file format. Resetting to empty array.');
      fs.writeFileSync(MEMORY_FILE, JSON.stringify([]));
      return [];
    }

    return parsed;
  } catch (error) {
    console.error('Error initializing user memories:', error);
    return [];
  }
}

// Save all user memories
function saveUserMemories(memories) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving user memories:', error);
    return false;
  }
}

// Get user memory
function getUserMemory(userId) {
  try {
    const memories = initUserMemories();

    // Find user memory
    const userMemory = memories.find(memory => memory.userId === userId);

    // Create user memory if it doesn't exist
    if (!userMemory) {
      const newMemory = {
        userId: userId,
        messages: [],
        userInfo: {},
        commonTopics: [],
        lastInteraction: Date.now(),
        createdAt: Date.now(),
        messageCount: 0,
        settings: {
          autoChatEnabled: false
        }
      };
      memories.push(newMemory);
      saveUserMemories(memories);
      return newMemory;
    }

    return userMemory;
  } catch (error) {
    console.error('Error getting user memory:', error);
    return {
      userId: userId,
      messages: [],
      userInfo: {},
      commonTopics: [],
      lastInteraction: Date.now(),
      createdAt: Date.now(),
      messageCount: 0,
      settings: {
        autoChatEnabled: false
      }
    };
  }
}

// Save a single user memory
function saveUserMemory(userId, memory) {
  try {
    const memories = initUserMemories();
    const index = memories.findIndex(m => m.userId === userId);

    if (index !== -1) {
      memories[index] = memory;
    } else {
      memories.push(memory);
    }

    return saveUserMemories(memories);
  } catch (error) {
    console.error('Error saving user memory:', error);
    return false;
  }
}

// Add message to user memory
function addMessageToMemory(userId, role, content) {
  try {
    const memory = getUserMemory(userId);

    memory.messages.push({
      role: role,
      content: content,
      timestamp: Date.now()
    });

    // Limit memory size
    if (memory.messages.length > 50) {
      memory.messages = memory.messages.slice(-50);
    }

    memory.lastInteraction = Date.now();
    memory.messageCount++;

    return saveUserMemory(userId, memory);
  } catch (error) {
    console.error('Error adding message to memory:', error);
    return false;
  }
}

// Get conversation history
function getConversationHistory(userId, limit = 10) {
  try {
    const memory = getUserMemory(userId);
    return memory.messages.slice(-limit);
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

// Update user information
function updateUserInfo(userId, info) {
  try {
    const memory = getUserMemory(userId);

    memory.userInfo = {
      ...memory.userInfo,
      ...info
    };

    return saveUserMemory(userId, memory);
  } catch (error) {
    console.error('Error updating user info:', error);
    return false;
  }
}

// Get user summary
function getUserSummary(userId) {
  try {
    const memory = getUserMemory(userId);
    return {
      messageCount: memory.messageCount,
      lastActive: new Date(memory.lastInteraction).toLocaleString(),
      commonTopics: memory.commonTopics || ['general']
    };
  } catch (error) {
    console.error('Error getting user summary:', error);
    return {
      messageCount: 0,
      lastActive: 'Unknown',
      commonTopics: ['general']
    };
  }
}

// Get user info
function getUserInfo(userId) {
  try {
    const memory = getUserMemory(userId);
    return memory.userInfo || {};
  } catch (error) {
    console.error('Error getting user info:', error);
    return {};
  }
}

// Cleanup old memories
function cleanupOldMemories(days = 60) {
  try {
    const memories = initUserMemories();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const filtered = memories.filter(memory => memory.lastInteraction >= cutoff);
    const cleaned = memories.length - filtered.length;

    if (cleaned > 0) {
      saveUserMemories(filtered);
    }

    return cleaned;
  } catch (error) {
    console.error('Error cleaning up old memories:', error);
    return 0;
  }
}

// Export functions
module.exports = {
  getUserMemory,
  saveUserMemory,
  addMessageToMemory,
  getConversationHistory,
  updateUserInfo,
  getUserSummary,
  getUserInfo,
  cleanupOldMemories
};
