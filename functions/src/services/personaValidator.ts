import * as admin from "firebase-admin";

const db = admin.firestore();

// Persona characteristics for validation
interface PersonaCharacteristics {
  id: string;
  name: string;
  tone: string[];
  vocabulary: string[];
  prohibitedWords: string[];
  responsePatterns: RegExp[];
  minConfidence: number;
  maxResponseLength: number;
  requiredElements: string[];
}

// Define persona characteristics
const PERSONA_CHARACTERISTICS: Record<string, PersonaCharacteristics> = {
  oracle: {
    id: "oracle",
    name: "The Oracle",
    tone: ["mystical", "cryptic", "wise", "prophetic"],
    vocabulary: ["foresee", "destiny", "prophecy", "vision", "divine", "cosmic", "fate", "foretell"],
    prohibitedWords: ["definitely", "certainly", "guaranteed", "sure thing"],
    responsePatterns: [
      /the (stars|cosmos|universe) (suggest|indicate|whisper)/i,
      /i (foresee|envision|divine)/i,
      /the (ancient|mystical) (wisdom|knowledge) (speaks|tells)/i
    ],
    minConfidence: 0.7,
    maxResponseLength: 300,
    requiredElements: ["mystical_language", "uncertainty_qualifier"]
  },
  
  rebel: {
    id: "rebel",
    name: "The Rebel",
    tone: ["aggressive", "bold", "contrarian", "confident"],
    vocabulary: ["dominate", "crush", "destroy", "bold", "risky", "maverick", "unconventional"],
    prohibitedWords: ["safe", "conservative", "careful", "maybe"],
    responsePatterns: [
      /(forget|ignore) (conventional|traditional) (wisdom|advice)/i,
      /(bold|risky|aggressive) (move|play|strategy)/i,
      /(dominate|crush|destroy) (your|the) (league|competition)/i
    ],
    minConfidence: 0.8,
    maxResponseLength: 250,
    requiredElements: ["aggressive_language", "contrarian_advice"]
  },
  
  mentor: {
    id: "mentor",
    name: "The Mentor",
    tone: ["supportive", "encouraging", "patient", "educational"],
    vocabulary: ["learn", "grow", "develop", "understand", "guide", "teach", "support"],
    prohibitedWords: ["stupid", "dumb", "obvious", "idiot"],
    responsePatterns: [
      /(let me|i'll) (help|guide|teach) you/i,
      /(great|good|excellent) (question|choice|thinking)/i,
      /(remember|keep in mind|consider)/i
    ],
    minConfidence: 0.6,
    maxResponseLength: 400,
    requiredElements: ["supportive_language", "educational_content"]
  },
  
  analyst: {
    id: "analyst",
    name: "The Analyst",
    tone: ["analytical", "data-driven", "precise", "methodical"],
    vocabulary: ["statistics", "data", "analysis", "metrics", "correlation", "probability"],
    prohibitedWords: ["gut feeling", "intuition", "hunch", "feeling"],
    responsePatterns: [
      /(according to|based on) (the )?(data|statistics|analysis)/i,
      /(probability|likelihood|correlation|trend)/i,
      /(\d+(\.\d+)?%|\d+ (points|yards|touchdowns))/i
    ],
    minConfidence: 0.8,
    maxResponseLength: 350,
    requiredElements: ["statistical_data", "analytical_reasoning"]
  },
  
  rookie: {
    id: "rookie",
    name: "The Rookie",
    tone: ["enthusiastic", "casual", "friendly", "excited"],
    vocabulary: ["awesome", "cool", "sweet", "dude", "totally", "amazing", "pumped"],
    prohibitedWords: ["complex", "sophisticated", "advanced", "intricate"],
    responsePatterns: [
      /(awesome|cool|sweet|amazing)/i,
      /(dude|man|bro)/i,
      /(totally|super|really) (excited|pumped|stoked)/i
    ],
    minConfidence: 0.5,
    maxResponseLength: 200,
    requiredElements: ["casual_language", "enthusiasm"]
  },
  
  zane: {
    id: "zane",
    name: "Zane AI Sports Reporter",
    tone: ["professional", "authoritative", "informative", "broadcast"],
    vocabulary: ["breaking", "report", "update", "analysis", "coverage", "developing"],
    prohibitedWords: ["opinion", "guess", "think", "feel"],
    responsePatterns: [
      /(breaking|developing) (news|story)/i,
      /(this is|coming to you) (live|direct)/i,
      /(reporting|coverage|analysis) (from|on)/i
    ],
    minConfidence: 0.9,
    maxResponseLength: 500,
    requiredElements: ["professional_tone", "factual_content"]
  }
};

export class PersonaValidator {
  // Validate persona response against characteristics
  static async validatePersonaResponse(
    personaId: string, 
    response: string, 
    context?: any
  ): Promise<{ valid: boolean; confidence: number; issues: string[]; suggestions: string[] }> {
    const characteristics = PERSONA_CHARACTERISTICS[personaId];
    
    if (!characteristics) {
      return {
        valid: false,
        confidence: 0,
        issues: ["Unknown persona ID"],
        suggestions: ["Use a valid persona ID"]
      };
    }
    
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;
    
    // Check response length
    if (response.length > characteristics.maxResponseLength) {
      issues.push(`Response too long (${response.length}/${characteristics.maxResponseLength} chars)`);
      suggestions.push("Shorten the response to match persona style");
      confidence -= 0.2;
    }
    
    if (response.length < 10) {
      issues.push("Response too short");
      suggestions.push("Provide more detailed response");
      confidence -= 0.3;
    }
    
    // Check for prohibited words
    const foundProhibited = characteristics.prohibitedWords.filter(word => 
      lowerResponse.includes(word.toLowerCase())
    );
    
    if (foundProhibited.length > 0) {
      issues.push(`Contains prohibited words: ${foundProhibited.join(", ")}`);
      suggestions.push(`Remove words that don't match ${characteristics.name}'s personality`);
      confidence -= 0.3 * foundProhibited.length;
    }
    
    // Check for characteristic vocabulary
    const foundVocabulary = characteristics.vocabulary.filter(word => 
      lowerResponse.includes(word.toLowerCase())
    );
    
    const vocabularyScore = foundVocabulary.length / characteristics.vocabulary.length;
    if (vocabularyScore < 0.1) {
      issues.push("Lacks characteristic vocabulary");
      suggestions.push(`Include words like: ${characteristics.vocabulary.slice(0, 3).join(", ")}`);
      confidence -= 0.2;
    }
    
    // Check for response patterns
    const matchedPatterns = characteristics.responsePatterns.filter(pattern => 
      pattern.test(response)
    );
    
    const patternScore = matchedPatterns.length / characteristics.responsePatterns.length;
    if (patternScore < 0.3) {
      issues.push("Does not match expected response patterns");
      suggestions.push(`Use more ${characteristics.name}-style phrasing`);
      confidence -= 0.2;
    }
    
    // Check required elements
    const elementChecks = await this.checkRequiredElements(
      response, 
      characteristics.requiredElements, 
      personaId
    );
    
    elementChecks.missing.forEach(element => {
      issues.push(`Missing required element: ${element}`);
      suggestions.push(`Add ${element.replace("_", " ")} to the response`);
      confidence -= 0.15;
    });
    
    // Ensure confidence doesn't go below 0
    confidence = Math.max(0, confidence);
    
    // Check if meets minimum confidence
    const valid = confidence >= characteristics.minConfidence && issues.length === 0;
    
    // Log validation result
    await this.logValidationResult(personaId, response, {
      valid,
      confidence,
      issues,
      suggestions
    });
    
    return {
      valid,
      confidence,
      issues,
      suggestions
    };
  }
  
  // Check for required elements in response
  private static async checkRequiredElements(
    response: string, 
    requiredElements: string[], 
    personaId: string
  ): Promise<{ present: string[]; missing: string[] }> {
    const present: string[] = [];
    const missing: string[] = [];
    
    for (const element of requiredElements) {
      const hasElement = await this.checkElement(response, element, personaId);
      if (hasElement) {
        present.push(element);
      } else {
        missing.push(element);
      }
    }
    
    return { present, missing };
  }
  
  // Check specific element in response
  private static async checkElement(response: string, element: string, personaId: string): Promise<boolean> {
    
    switch (element) {
    case "mystical_language":
      return /\b(cosmic|divine|mystical|ancient|prophecy|vision|foresee)\b/i.test(response);
        
    case "uncertainty_qualifier":
      return /\b(may|might|could|perhaps|possibly|seems|appears)\b/i.test(response);
        
    case "aggressive_language":
      return /\b(dominate|crush|destroy|bold|aggressive|risky)\b/i.test(response);
        
    case "contrarian_advice":
      return /\b(forget|ignore|against|contrary|unconventional)\b/i.test(response);
        
    case "supportive_language":
      return /\b(help|support|guide|encourage|great|good|excellent)\b/i.test(response);
        
    case "educational_content":
      return /\b(learn|understand|remember|consider|because|since)\b/i.test(response);
        
    case "statistical_data":
      return /\b(\d+(\.\d+)?%|\d+\s+(yards|points|touchdowns|receptions))\b/i.test(response);
        
    case "analytical_reasoning":
      return /\b(analysis|data|statistics|correlation|trend|probability)\b/i.test(response);
        
    case "casual_language":
      return /\b(dude|man|bro|awesome|cool|sweet|totally)\b/i.test(response);
        
    case "enthusiasm":
      return /\b(excited|pumped|stoked|amazing|awesome|love)\b/i.test(response);
        
    case "professional_tone":
      return /\b(report|analysis|coverage|update|breaking|developing)\b/i.test(response);
        
    case "factual_content":
      return !/\b(i think|i feel|in my opinion|i believe)\b/i.test(response);
        
    default:
      return true; // Unknown element, assume present
    }
  }
  
  // Log validation result for monitoring
  private static async logValidationResult(
    personaId: string, 
    response: string, 
    result: any
  ): Promise<void> {
    try {
      await db.collection("persona_validations").add({
        personaId,
        responseLength: response.length,
        valid: result.valid,
        confidence: result.confidence,
        issueCount: result.issues.length,
        timestamp: new Date(),
        // Don't store full response for privacy
        responseHash: this.hashString(response)
      });
    } catch (error: any) {
      console.error("Error logging validation result:", error);
    }
  }
  
  // Simple hash function for response tracking
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  // Get persona characteristics
  static getPersonaCharacteristics(personaId: string): PersonaCharacteristics | null {
    return PERSONA_CHARACTERISTICS[personaId] || null;
  }
  
  // Get validation statistics
  static async getValidationStats(personaId?: string): Promise<any> {
    try {
      let query = db.collection("persona_validations");
      
      if (personaId) {
        query = query.where("personaId", "==", personaId);
      }
      
      const snapshot = await query
        .orderBy("timestamp", "desc")
        .limit(1000)
        .get();
      
      const validations = snapshot.docs.map(doc => doc.data());
      
      const stats = {
        total: validations.length,
        valid: validations.filter(v => v.valid).length,
        averageConfidence: validations.reduce((sum, v) => sum + v.confidence, 0) / validations.length,
        byPersona: {} as Record<string, any>
      };
      
      // Group by persona
      const byPersona = validations.reduce((acc, v) => {
        if (!acc[v.personaId]) {
          acc[v.personaId] = [];
        }
        acc[v.personaId].push(v);
        return acc;
      }, {} as Record<string, any[]>);
      
      for (const [pid, vals] of Object.entries(byPersona)) {
        stats.byPersona[pid] = {
          total: vals.length,
          valid: vals.filter(v => v.valid).length,
          averageConfidence: vals.reduce((sum, v) => sum + v.confidence, 0) / vals.length
        };
      }
      
      return stats;
    } catch (error: any) {
      console.error("Error getting validation stats:", error);
      return null;
    }
  }
  
  // Improve persona response based on validation
  static improveResponse(
    originalResponse: string, 
    validationResult: any, 
    personaId: string
  ): string {
    if (validationResult.valid) {
      return originalResponse;
    }
    
    let improvedResponse = originalResponse;
    const characteristics = PERSONA_CHARACTERISTICS[personaId];
    
    if (!characteristics) {
      return originalResponse;
    }
    
    // Add characteristic vocabulary if missing
    if (validationResult.issues.some((issue: string) => issue.includes("vocabulary"))) {
      const randomVocab = characteristics.vocabulary[
        Math.floor(Math.random() * characteristics.vocabulary.length)
      ];
      improvedResponse = `${improvedResponse} ${randomVocab}`;
    }
    
    // Add persona-specific improvements
    switch (personaId) {
    case "oracle":
      if (!improvedResponse.includes("foresee") && !improvedResponse.includes("divine")) {
        improvedResponse = `I foresee that ${improvedResponse.toLowerCase()}`;
      }
      break;
        
    case "rebel":
      if (!improvedResponse.includes("bold") && !improvedResponse.includes("aggressive")) {
        improvedResponse = `Here's a bold take: ${improvedResponse}`;
      }
      break;
        
    case "mentor":
      if (!improvedResponse.includes("help") && !improvedResponse.includes("guide")) {
        improvedResponse = `Let me help you understand: ${improvedResponse}`;
      }
      break;
        
    case "analyst":
      if (!/\d+/.test(improvedResponse)) {
        improvedResponse = `Based on the data, ${improvedResponse}`;
      }
      break;
        
    case "rookie":
      if (!improvedResponse.includes("awesome") && !improvedResponse.includes("cool")) {
        improvedResponse = `Dude, that's awesome! ${improvedResponse}`;
      }
      break;
    }
    
    return improvedResponse;
  }
}

