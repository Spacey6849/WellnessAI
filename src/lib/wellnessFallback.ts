import mentalWellnessData from '@/data/mentalWellnessResponses.json';

interface Intent {
  tag: string;
  patterns: string[];
  responses: string[];
}

interface WellnessResponse {
  response: string;
  tag: string;
  confidence: number;
}

class WellnessFallbackService {
  private data = mentalWellnessData;
  private responseCache = new Map<string, WellnessResponse>();

  /**
   * Simple pattern scoring: counts how many pattern phrases appear (substring or word boundary)
   * Returns a positive integer score; higher means better match.
   */
  private calculatePatternMatch(message: string, patterns: string[]): number {
    let score = 0;
    for (const raw of patterns) {
      const p = raw.trim().toLowerCase();
      if (!p) continue;
      // If pattern is longer than 3 chars, use substring check; else enforce word boundary
      if (p.length > 3) {
        if (message.includes(p)) score += 1;
      } else {
        const re = new RegExp(`(^|\b)${p.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}($|\b)`, 'i');
        if (re.test(message)) score += 1;
      }
    }
    return score;
  }

  /**
   * Analyze user input to find the best matching intent
   */
  analyzeUserIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    let bestMatch = 'no-response';
    let maxScore = 0;

    // Check for crisis patterns first (highest priority)
    const suicideIntent = this.data.intents.find(intent => intent.tag === 'suicide');
    if (suicideIntent) {
      const crisisScore = this.calculatePatternMatch(lowerMessage, suicideIntent.patterns);
      if (crisisScore > 0) {
        return 'suicide';
      }
    }

    // Check all intents for pattern matches
    this.data.intents.forEach((intent: Intent) => {
      if (intent.tag === 'suicide') return; // Already checked
      
      const score = this.calculatePatternMatch(lowerMessage, intent.patterns);
      
      if (score > maxScore) {
        maxScore = score;
        bestMatch = intent.tag;
      }
    });

    return bestMatch;
  }

  /**
   * Get a contextual response based on user input
   */
  getContextualResponse(message: string): WellnessResponse {
    const cacheKey = message.toLowerCase().trim();
    
    if (this.responseCache.has(cacheKey)) {
      return this.responseCache.get(cacheKey)!;
    }

    const tag = this.analyzeUserIntent(message);
    const intent = this.data.intents.find(intent => intent.tag === tag);
    
    if (!intent) {
      return this.getFallbackResponse();
    }

    const response = this.getRandomResponse(intent.responses);
    const result: WellnessResponse = {
      response,
      tag,
      confidence: 0.8
    };

    this.responseCache.set(cacheKey, result);
    return result;
  }

  /**
   * Get a fallback response when no intent matches
   */
  private getFallbackResponse(): WellnessResponse {
    const fallbackIntent = this.data.intents.find(intent => intent.tag === 'no-response');
    const response = fallbackIntent ? this.getRandomResponse(fallbackIntent.responses) : "I'm here to listen. Can you tell me more about what's on your mind?";
    
    return {
      response,
      tag: 'no-response',
      confidence: 0.3
    };
  }

  /**
   * Get a random response from an array
   */
  private getRandomResponse(responses: string[]): string {
    const index = Math.floor(Math.random() * responses.length);
    return responses[index];
  }

  /**
   * Get emergency resources for crisis situations
   */
  getEmergencyResources() {
    return {
      crisis_lines: [
        {
          name: "National Suicide Prevention Lifeline",
          number: "988", 
          description: "24/7 confidential support for people in distress"
        },
        {
          name: "Crisis Text Line",
          number: "Text HOME to 741741",
          description: "24/7 text-based crisis support"
        },
        {
          name: "SAMHSA National Helpline", 
          number: "1-800-662-4357",
          description: "Mental health and substance abuse treatment referrals"
        }
      ]
    };
  }

  /**
   * Check if message indicates a crisis situation
   */
  isCrisisMessage(message: string): boolean {
    const tag = this.analyzeUserIntent(message);
    return tag === 'suicide';
  }

  /**
   * Enhanced response with additional context
   */
  getEnhancedResponse(message: string): string {
    const contextResponse = this.getContextualResponse(message);
    let response = contextResponse.response;

    // Add extra context for specific tags
    if (contextResponse.tag === 'anxious' || contextResponse.tag === 'stressed') {
      response += '\n\n� **Quick Tip:** Try the 4-7-8 breathing technique: Breathe in for 4 counts, hold for 7, exhale for 8. Repeat 3-4 times.';
    } else if (contextResponse.tag === 'sad' || contextResponse.tag === 'depressed') {
      response += '\n\n🌱 **Remember:** Small steps count. Even getting dressed or drinking water today is an achievement worth recognizing.';
    } else if (contextResponse.tag === 'sleep') {
      response += '\n\n🌙 **Sleep Tip:** Try creating a calming bedtime routine - dim lights 1 hour before bed, avoid screens, and keep your room cool.';
    }

    return response;
  }

  /**
   * Determine if we should use Gemini or JSON fallback based on message complexity
   */
  shouldUseGemini(message: string): boolean {
    // Use JSON for common patterns, Gemini for complex queries
    const commonTags = ['greeting', 'goodbye', 'thanks', 'morning', 'afternoon', 'evening', 'night', 'about', 'casual'];
    const tag = this.analyzeUserIntent(message);
    
    // If it matches a common pattern, use JSON
    if (commonTags.includes(tag)) return false;
    
    // For complex queries or longer messages, prefer Gemini
    return message.length > 50 || !this.data.intents.some(intent => intent.tag === tag);
  }
}

export const wellnessFallback = new WellnessFallbackService();
export default wellnessFallback;