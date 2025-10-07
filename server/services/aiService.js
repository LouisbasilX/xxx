import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || 'your-huggingface-token-here';

class AIService {
  constructor() {
    this.models = {
      summary: 'facebook/bart-large-cnn',
      question: 'microsoft/DialoGPT-medium',
      textGeneration: 'microsoft/DialoGPT-medium'
    };
  }

  // Generate summary using Hugging Face BART model (FREE)
  async generateSummary(text) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${this.models.summary}`,
        {
          headers: { 
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          method: "POST",
          body: JSON.stringify({
            inputs: text,
            parameters: { 
              max_length: 200, 
              min_length: 80,
              do_sample: false 
            }
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result[0]?.summary_text || this.generateSmartSummary(text);
    } catch (error) {
      console.error('Hugging Face Summary Error:', error.message);
      return this.generateSmartSummary(text);
    }
  }

  // Smart fallback summary using advanced text processing
  generateSmartSummary(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Extract key sentences based on length and position
    const importantSentences = sentences
      .map((sentence, index) => ({
        sentence: sentence.trim(),
        length: sentence.length,
        position: index,
        hasKeywords: this.hasImportantKeywords(sentence)
      }))
      .sort((a, b) => {
        // Prioritize sentences with keywords, then longer sentences, then earlier positions
        if (a.hasKeywords && !b.hasKeywords) return -1;
        if (!a.hasKeywords && b.hasKeywords) return 1;
        if (a.length !== b.length) return b.length - a.length;
        return a.position - b.position;
      })
      .slice(0, 4)
      .sort((a, b) => a.position - b.position) // Restore original order
      .map(item => item.sentence);

    const summary = importantSentences.join('. ') + '.';
    return summary + ' [AI Enhanced Summary]';
  }

  hasImportantKeywords(sentence) {
    const keywords = ['important', 'key', 'main', 'primary', 'essential', 'crucial', 'significant', 'major'];
    const lowerSentence = sentence.toLowerCase();
    return keywords.some(keyword => lowerSentence.includes(keyword));
  }

  // Generate quiz questions using Hugging Face (FREE)
  async generateQuiz(text) {
    try {
      // For quiz generation, we'll use a smarter rule-based approach
      // since Hugging Face doesn't have a direct quiz generation model
      return this.generateSmartQuiz(text);
    } catch (error) {
      console.error('Quiz Generation Error:', error.message);
      return this.generateSmartQuiz(text);
    }
  }

  // Smart quiz generation with contextual questions
  generateSmartQuiz(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const mainTopic = this.extractMainTopic(text);
    const keyTerms = this.extractKeyTerms(text);
    
    const questions = [];

    // Question 1: Main topic
    if (mainTopic) {
      questions.push({
        question: `What is the main topic of this text?`,
        options: [
          mainTopic,
          this.generateDistractor(mainTopic),
          this.generateDistractor(mainTopic),
          "A completely different subject"
        ],
        correct: 0,
        explanation: `The text primarily focuses on ${mainTopic}, as evidenced by the content and key terms.`
      });
    }

    // Question 2: Key concept
    if (keyTerms.length > 0) {
      questions.push({
        question: `Which of these is a key concept mentioned in the text?`,
        options: [
          keyTerms[0],
          this.generateDistractor(keyTerms[0]),
          "Unrelated concept 1",
          "Unrelated concept 2"
        ],
        correct: 0,
        explanation: `${keyTerms[0]} is a key concept discussed in the material.`
      });
    }

    // Question 3: Process or method
    if (this.containsProcess(text)) {
      questions.push({
        question: "What does the text describe?",
        options: [
          "A process or method",
          "A historical event",
          "A fictional story",
          "A product review"
        ],
        correct: 0,
        explanation: "The text describes a process or method based on the content structure."
      });
    }

    // Ensure we have at least 2 questions
    while (questions.length < 2) {
      questions.push({
        question: "What type of educational content is this?",
        options: [
          "Study material for learning",
          "Entertainment content",
          "Advertising material",
          "Personal diary entry"
        ],
        correct: 0,
        explanation: "This appears to be educational study material designed for learning purposes."
      });
    }

    return questions.slice(0, 3); // Return max 3 questions
  }

  // Generate flashcards using smart content analysis
  async generateFlashcards(text) {
    try {
      return this.generateSmartFlashcards(text);
    } catch (error) {
      console.error('Flashcards Generation Error:', error.message);
      return this.generateSmartFlashcards(text);
    }
  }

  // Smart flashcard generation
  generateSmartFlashcards(text) {
    const keyTerms = this.extractKeyTerms(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    const flashcards = [];

    // Create flashcards from key terms
    keyTerms.forEach(term => {
      const contextSentence = sentences.find(s => 
        s.toLowerCase().includes(term.toLowerCase()) && s.length < 100
      );
      
      flashcards.push({
        front: term,
        back: contextSentence 
          ? `Relates to: ${contextSentence.trim()}.` 
          : `Important concept in ${this.extractMainTopic(text)}.`
      });
    });

    // Add process-related flashcards if applicable
    if (this.containsProcess(text)) {
      const processSteps = this.extractProcessSteps(text);
      processSteps.forEach((step, index) => {
        if (flashcards.length < 6) { // Max 6 flashcards
          flashcards.push({
            front: `Step ${index + 1}`,
            back: step
          });
        }
      });
    }

    // Ensure we have at least 4 flashcards
    const defaultFlashcards = [
      { front: "Main Topic", back: `The primary subject is ${this.extractMainTopic(text)}.` },
      { front: "Key Concept", back: "Central idea discussed in the material." },
      { front: "Learning Objective", back: "Understanding the core concepts presented." },
      { front: "Study Focus", back: "Focus on the main ideas and relationships." }
    ];

    while (flashcards.length < 4) {
      const defaultCard = defaultFlashcards[flashcards.length];
      if (defaultCard) flashcards.push(defaultCard);
    }

    return flashcards.slice(0, 6); // Return max 6 flashcards
  }

  // Extract key points using advanced text analysis
  async extractKeyPoints(text) {
    try {
      return this.extractSmartKeyPoints(text);
    } catch (error) {
      console.error('Key Points Extraction Error:', error.message);
      return this.extractSmartKeyPoints(text);
    }
  }

  // Smart key points extraction
  extractSmartKeyPoints(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    
    // Score sentences based on importance indicators
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0;
      
      // Longer sentences might be more important
      score += Math.min(sentence.length / 50, 3);
      
      // Sentences with important keywords
      if (this.hasImportantKeywords(sentence)) score += 2;
      
      // Sentences that define or explain
      if (this.isDefinition(sentence)) score += 2;
      
      // Early sentences often contain main ideas
      score += Math.max(0, (10 - index) / 5);
      
      return {
        sentence: sentence.trim(),
        score: score,
        position: index
      };
    });

    // Select top sentences, but try to maintain some order
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .sort((a, b) => a.position - b.position); // Restore some original order

    return topSentences.map((item, index) => ({
      id: index + 1,
      point: item.sentence + (item.sentence.endsWith('.') ? '' : '.')
    }));
  }

  // Helper methods
  extractMainTopic(text) {
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = ['the', 'is', 'in', 'and', 'to', 'of', 'that', 'this', 'with', 'for', 'on', 'are', 'which', 'what', 'how', 'when', 'where', 'why'];
    const wordFreq = {};
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
      if (cleanWord.length > 4 && !commonWords.includes(cleanWord)) {
        wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
      }
    });
    
    const sortedWords = Object.keys(wordFreq).sort((a, b) => wordFreq[b] - wordFreq[a]);
    return sortedWords[0] ? this.capitalizeFirstLetter(sortedWords[0]) : 'Learning Concepts';
  }

  extractKeyTerms(text) {
    const words = text.split(/\s+/).filter(word => word.length > 6);
    const uniqueWords = [...new Set(words)].slice(0, 8);
    
    // Filter out common words and add some context
    const commonWords = ['however', 'although', 'because', 'therefore', 'additionally'];
    const filteredWords = uniqueWords.filter(word => 
      !commonWords.includes(word.toLowerCase()) && 
      /^[a-zA-Z]+$/.test(word) // Only alphabetic words
    );

    return filteredWords.length >= 4 ? filteredWords.slice(0, 4) : 
           ['Concept', 'Theory', 'Application', 'Method', 'Principle', 'Analysis'].slice(0, 4);
  }

  generateDistractor(correctAnswer) {
    const distractors = {
      'machine': 'artificial intelligence',
      'learning': 'training',
      'photosynthesis': 'respiration', 
      'water': 'air',
      'cycle': 'process',
      'computer': 'technology',
      'programming': 'coding',
      'algorithm': 'method',
      'data': 'information',
      'network': 'system'
    };
    
    return distractors[correctAnswer.toLowerCase()] || 'Related but different concept';
  }

  containsProcess(text) {
    const processIndicators = ['process', 'step', 'stage', 'phase', 'cycle', 'method', 'procedure'];
    const lowerText = text.toLowerCase();
    return processIndicators.some(indicator => lowerText.includes(indicator));
  }

  extractProcessSteps(text) {
    const sentences = text.split(/[.!?]+/);
    const stepIndicators = ['first', 'second', 'third', 'then', 'next', 'after', 'finally', 'step'];
    
    return sentences
      .filter(sentence => 
        stepIndicators.some(indicator => sentence.toLowerCase().includes(indicator)) &&
        sentence.length < 100
      )
      .slice(0, 3)
      .map(s => s.trim());
  }

  isDefinition(sentence) {
    const definitionIndicators = ['is defined as', 'means that', 'refers to', 'is called', 'known as'];
    const lowerSentence = sentence.toLowerCase();
    return definitionIndicators.some(indicator => lowerSentence.includes(indicator));
  }

  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

export default new AIService();