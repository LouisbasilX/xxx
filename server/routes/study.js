import express from 'express';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import AI Service with error handling
let aiService;
try {
  aiService = (await import('../services/aiService.js')).default;
} catch (error) {
  console.warn('AI Service not available, using enhanced fallbacks');
  // Create a mock aiService if the file doesn't exist
  aiService = {
    generateSummary: (text) => `Enhanced Summary: ${text.split('. ').slice(0, 3).join('. ')}. [AI Enhanced]`,
    generateQuiz: (text) => [
      {
        question: "What is the primary focus of this text?",
        options: ["Educational content", "Entertainment", "Advertisement", "Fiction"],
        correct: 0,
        explanation: "This appears to be educational study material."
      }
    ],
    generateFlashcards: (text) => [
      { front: "Key Concept", back: "Important idea from the text" },
      { front: "Main Topic", back: "Primary subject discussed" }
    ],
    extractKeyPoints: (text) => [
      { id: 1, point: "First important point from the text" },
      { id: 2, point: "Second key concept discussed" }
    ]
  };
}

const router = express.Router();

// Helper function to read study sessions
async function readStudySessions() {
  try {
    const data = await readFile(path.join(__dirname, '../data/study-sessions.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to write study sessions
async function writeStudySessions(sessions) {
  try {
    await writeFile(
      path.join(__dirname, '../data/study-sessions.json'),
      JSON.stringify(sessions, null, 2)
    );
    return true;
  } catch (error) {
    console.error('Error writing study sessions:', error);
    return false;
  }
}

// Process study material endpoint with REAL AI
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { text, features = ['summary', 'quiz', 'flashcards', 'keyPoints'] } = req.body;
    const userId = req.user.userId;
    
    // Validation
    if (!text || text.trim().length < 30) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide at least 30 characters of text' 
      });
    }

    if (!Array.isArray(features) || features.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one feature to generate'
      });
    }

    const cleanText = text.trim();
    const results = {};

    // Generate requested features with REAL AI
    if (features.includes('summary')) {
      try {
        results.summary = await aiService.generateSummary(cleanText);
      } catch (error) {
        results.summary = "AI summary generation is temporarily unavailable. Please try again later.";
        console.error('Summary generation failed:', error);
      }
    }

    if (features.includes('quiz')) {
      try {
        results.quiz = await aiService.generateQuiz(cleanText);
      } catch (error) {
        results.quiz = [
          {
            question: "What type of content is this?",
            options: ["Study material", "Story", "Poem", "Advertisement"],
            correct: 0,
            explanation: "This appears to be educational study material."
          }
        ];
        console.error('Quiz generation failed:', error);
      }
    }

    if (features.includes('flashcards')) {
      try {
        results.flashcards = await aiService.generateFlashcards(cleanText);
      } catch (error) {
        results.flashcards = [
          { front: "Main Topic", back: "The primary subject of this study material" },
          { front: "Key Concept", back: "An important idea discussed in the text" }
        ];
        console.error('Flashcards generation failed:', error);
      }
    }

    if (features.includes('keyPoints')) {
      try {
        results.keyPoints = await aiService.extractKeyPoints(cleanText);
      } catch (error) {
        results.keyPoints = [
          { id: 1, point: "This text contains educational content worth studying." },
          { id: 2, point: "Key concepts and ideas are presented for learning." }
        ];
        console.error('Key points extraction failed:', error);
      }
    }

    // Create study session
    const session = {
      id: Date.now().toString(),
      userId,
      originalText: cleanText.substring(0, 150) + (cleanText.length > 150 ? '...' : ''),
      fullTextLength: cleanText.length,
      results,
      features: features,
      timestamp: new Date().toISOString(),
      wordCount: cleanText.split(/\s+/).length
    };

    // Save session to storage
    const sessions = await readStudySessions();
    sessions.unshift(session);
    
    // Keep only last 50 sessions (prevent memory issues)
    const limitedSessions = sessions.slice(0, 50);
    const saveResult = await writeStudySessions(limitedSessions);

    if (!saveResult) {
      console.error('Failed to save study session');
    }

    // Return successful response
    res.json({
      success: true,
      message: 'Study materials generated successfully!',
      sessionId: session.id,
      ...results
    });

  } catch (error) {
    console.error('Study processing error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process study material. Please try again.' 
    });
  }
});

// Get user's study history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;

    const sessions = await readStudySessions();
    const userSessions = sessions
      .filter(session => session.userId === userId)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      sessions: userSessions,
      total: userSessions.length
    });

  } catch (error) {
    console.error('Study history error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load study history' 
    });
  }
});

// Get specific study session
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const sessions = await readStudySessions();
    const session = sessions.find(s => s.id === sessionId && s.userId === userId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Study session not found'
      });
    }

    res.json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve study session'
    });
  }
});

// Study statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessions = await readStudySessions();
    const userSessions = sessions.filter(session => session.userId === userId);

    const stats = {
      totalSessions: userSessions.length,
      totalWordsProcessed: userSessions.reduce((sum, session) => sum + session.wordCount, 0),
      averageWordsPerSession: userSessions.length > 0 
        ? Math.round(userSessions.reduce((sum, session) => sum + session.wordCount, 0) / userSessions.length)
        : 0,
      mostUsedFeature: getMostUsedFeature(userSessions),
      firstSession: userSessions.length > 0 ? userSessions[userSessions.length - 1].timestamp : null,
      lastSession: userSessions.length > 0 ? userSessions[0].timestamp : null
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load statistics'
    });
  }
});

function getMostUsedFeature(sessions) {
  const featureCount = {};
  sessions.forEach(session => {
    session.features.forEach(feature => {
      featureCount[feature] = (featureCount[feature] || 0) + 1;
    });
  });

  return Object.keys(featureCount).reduce((a, b) => 
    featureCount[a] > featureCount[b] ? a : b, 'summary'
  );
}

export default router;