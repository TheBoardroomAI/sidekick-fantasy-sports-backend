import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import { db, COLLECTIONS, SubscriptionTier } from "../config/firebase";
import { DataIntegrationService } from "./data-integration";
import { VoiceSystemService, PERSONA_VOICES } from "./voice-system";
import { SubscriptionService } from "./subscription";

// OpenAI Configuration
const OPENAI_API_KEY = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = "https://api.openai.com/v1";

// Persona Configurations
export const PERSONA_CONFIGS = {
  ORACLE: {
    name: "The Oracle",
    personality: "Mystical, wise, prophetic. Speaks in metaphors and sees patterns others miss. Uses ancient wisdom to predict fantasy outcomes.",
    systemPrompt: `You are The Oracle, a mystical fantasy football advisor. You see patterns in the data that others cannot perceive. Speak with wisdom and use metaphors from ancient times. Your predictions are based on deep data analysis but presented as mystical insights. Always reference "the data spirits" and "cosmic alignments" when discussing player performance.`,
    dataWeighting: {
      trends: 0.4,
      advanced_metrics: 0.3,
      matchups: 0.2,
      intuition: 0.1
    },
    voicePersona: "ORACLE"
  },
  REBEL: {
    name: "The Rebel", 
    personality: "Contrarian, edgy, confident. Challenges conventional wisdom and finds value in overlooked players. Takes calculated risks.",
    systemPrompt: `You are The Rebel, a contrarian fantasy football advisor who challenges conventional wisdom. You find value where others don't look and aren't afraid to recommend risky plays. Be confident, slightly edgy, and always question the popular consensus. Look for undervalued players and contrarian strategies.`,
    dataWeighting: {
      contrarian_indicators: 0.4,
      value_metrics: 0.3,
      ownership_data: 0.2,
      risk_tolerance: 0.1
    },
    voicePersona: "REBEL"
  },
  MENTOR: {
    name: "The Mentor",
    personality: "Patient, teaching, encouraging. Explains concepts clearly and helps users learn fantasy football strategy.",
    systemPrompt: `You are The Mentor, a patient and encouraging fantasy football teacher. Your goal is to help users understand not just what to do, but why. Explain concepts clearly, be supportive, and always focus on helping users improve their fantasy football knowledge. Use teaching moments in every interaction.`,
    dataWeighting: {
      fundamentals: 0.4,
      educational_value: 0.3,
      long_term_strategy: 0.2,
      player_development: 0.1
    },
    voicePersona: "MENTOR"
  },
  ANALYST: {
    name: "The Analyst",
    personality: "Data-driven, precise, analytical. Focuses on numbers, statistics, and quantitative analysis.",
    systemPrompt: `You are The Analyst, a data-driven fantasy football expert. You rely heavily on statistics, advanced metrics, and quantitative analysis. Present information with precision, cite specific numbers, and always back up recommendations with concrete data. Focus on EPA, YPRR, air yards, target share, and other advanced metrics.`,
    dataWeighting: {
      advanced_stats: 0.5,
      efficiency_metrics: 0.3,
      volume_metrics: 0.15,
      situational_data: 0.05
    },
    voicePersona: "ANALYST"
  },
  ROOKIE: {
    name: "The Rookie",
    personality: "Enthusiastic, energetic, learning. Asks questions and shares excitement about fantasy football.",
    systemPrompt: `You are The Rookie, an enthusiastic and energetic fantasy football fan who's still learning. You're excited about everything, ask lots of questions, and share your genuine enthusiasm. Sometimes you're unsure but always eager to learn and help. Be relatable to new fantasy players.`,
    dataWeighting: {
      basic_stats: 0.4,
      popular_opinion: 0.3,
      simple_metrics: 0.2,
      enthusiasm: 0.1
    },
    voicePersona: "ROOKIE"
  },
  ZANE: {
    name: "Zane the AI Sports Reporter",
    personality: "Professional broadcaster, dramatic, authoritative. Delivers breaking news and analysis with sports media flair.",
    systemPrompt: `You are Zane, an AI Sports Reporter with the dramatic flair of a professional broadcaster. You deliver breaking fantasy football news, injury reports, and analysis with authority and excitement. Use sports media language, create urgency around important news, and always focus on fantasy relevance. Rate news impact on a 1-10 scale.`,
    dataWeighting: {
      breaking_news: 0.4,
      injury_impact: 0.3,
      fantasy_relevance: 0.2,
      urgency: 0.1
    },
    voicePersona: "ZANE"
  }
};

export type PersonaType = keyof typeof PERSONA_CONFIGS;

export interface ConversationContext {
  userId: string;
  persona: PersonaType;
  conversationId: string;
  messageHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
  userPreferences: {
    favoriteTeams: string[];
    riskTolerance: "conservative" | "moderate" | "aggressive";
    experienceLevel: "beginner" | "intermediate" | "expert";
  };
  currentWeek: number;
  season: string;
}

export class PersonaEngineService {
  // Export db for route access
  static db = db;
  static PERSONA_CONFIGS = PERSONA_CONFIGS;

  /**
   * Process a user query with a specific persona
   */
  static async processPersonaQuery(
    userId: string,
    persona: PersonaType,
    query: string,
    context: Partial<ConversationContext> = {}
  ): Promise<{
    textResponse: string;
    audioResponse?: string;
    conversationId: string;
    dataUsed: any;
  }> {
    try {
      // Check subscription access
      const user = await db.collection(COLLECTIONS.USERS).doc(userId).get();
      const userData = user.data();
      
      if (!SubscriptionService.canAccessPersona(userData?.subscriptionTier, persona.toLowerCase())) {
        throw new Error(`Subscription tier ${userData?.subscriptionTier} cannot access ${persona}`);
      }

      // Get or create conversation context
      const conversationContext = await this.getOrCreateConversationContext(
        userId, 
        persona, 
        context
      );

      // Gather relevant data based on persona's data weighting
      const relevantData = await this.gatherPersonaRelevantData(persona, query, conversationContext);

      // Generate response using OpenAI with persona-specific prompt
      const textResponse = await this.generatePersonaResponse(
        persona,
        query,
        conversationContext,
        relevantData
      );

      // Generate voice response if user has voice enabled
      let audioResponse;
      if (userData?.preferences?.voiceEnabled && SubscriptionService.hasFeatureAccess(userData?.subscriptionTier, "voiceEnabled")) {
        const voiceResult = await VoiceSystemService.generateSpeech(
          textResponse,
          PERSONA_CONFIGS[persona].voicePersona as keyof typeof PERSONA_VOICES
        );
        audioResponse = voiceResult.audioData;
      }

      // Update conversation history
      await this.updateConversationHistory(
        conversationContext.conversationId,
        query,
        textResponse
      );

      // Update user usage
      await this.updateUserUsage(userId);

      return {
        textResponse,
        audioResponse,
        conversationId: conversationContext.conversationId,
        dataUsed: relevantData
      };

    } catch (error) {
      functions.logger.error("Persona query error:", error);
      throw new Error(`Persona query failed: ${error}`);
    }
  }

  /**
   * Generate persona-specific response using OpenAI
   */
  static async generatePersonaResponse(
    persona: PersonaType,
    query: string,
    context: ConversationContext,
    relevantData: any
  ): Promise<string> {
    try {
      const personaConfig = PERSONA_CONFIGS[persona];
      
      // Build context-aware prompt
      const systemPrompt = `${personaConfig.systemPrompt}

Current Context:
- Week: ${context.currentWeek}
- Season: ${context.season}
- User's favorite teams: ${context.userPreferences.favoriteTeams.join(", ")}
- User's risk tolerance: ${context.userPreferences.riskTolerance}
- User's experience level: ${context.userPreferences.experienceLevel}

Available Data:
${JSON.stringify(relevantData, null, 2)}

Remember to stay in character as ${personaConfig.name} and use the personality traits: ${personaConfig.personality}`;

      // Build message history for context
      const messages = [
        { role: "system", content: systemPrompt },
        ...context.messageHistory.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: query }
      ];

      const response = await axios.post(
        `${OPENAI_BASE_URL}/chat/completions`,
        {
          model: "gpt-4",
          messages,
          max_tokens: 500,
          temperature: this.getPersonaTemperature(persona),
          presence_penalty: 0.1,
          frequency_penalty: 0.1
        },
        {
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      return response.data.choices[0].message.content;

    } catch (error) {
      functions.logger.error("OpenAI API error:", error);
      throw new Error(`Failed to generate response: ${error}`);
    }
  }

  /**
   * Gather relevant data based on persona's data weighting preferences
   */
  static async gatherPersonaRelevantData(
    persona: PersonaType,
    query: string,
    context: ConversationContext
  ): Promise<any> {
    try {
      const personaConfig = PERSONA_CONFIGS[persona];
      const dataWeighting = personaConfig.dataWeighting;

      // Extract player/team mentions from query
      const playerMentions = this.extractPlayerMentions(query);
      const teamMentions = this.extractTeamMentions(query);

      const relevantData: any = {
        query_analysis: {
          players_mentioned: playerMentions,
          teams_mentioned: teamMentions,
          query_type: this.classifyQuery(query)
        }
      };

      // Gather data based on persona preferences
      const hasAdvancedData = "trends" in dataWeighting || "advanced_metrics" in dataWeighting || "advanced_stats" in dataWeighting;
      if (hasAdvancedData) {
        relevantData.player_data = await Promise.all(
          playerMentions.map(playerId => 
            DataIntegrationService.getPlayerDataWithCache(playerId)
          )
        );
      }

      const hasStatsData = "advanced_stats" in dataWeighting || "efficiency_metrics" in dataWeighting;
      if (hasStatsData) {
        relevantData.advanced_metrics = await DataIntegrationService.getAdvancedPlayerMetrics();
      }

      const hasContrarianData = "contrarian_indicators" in dataWeighting || "ownership_data" in dataWeighting;
      if (hasContrarianData) {
        relevantData.trending_data = await DataIntegrationService.getTrendingPlayers();
      }

      const hasMatchupData = "matchups" in dataWeighting || "fundamentals" in dataWeighting;
      if (hasMatchupData) {
        relevantData.game_data = await DataIntegrationService.getTank01GameData();
      }

      // Add persona-specific data processing
      relevantData.persona_insights = this.generatePersonaInsights(persona, relevantData);

      return relevantData;

    } catch (error) {
      functions.logger.error("Data gathering error:", error);
      return { error: "Failed to gather relevant data" };
    }
  }

  /**
   * Get or create conversation context
   */
  static async getOrCreateConversationContext(
    userId: string,
    persona: PersonaType,
    partialContext: Partial<ConversationContext>
  ): Promise<ConversationContext> {
    try {
      // Try to get existing conversation
      let conversationId = partialContext.conversationId;
      
      if (!conversationId) {
        // Create new conversation
        conversationId = `${userId}_${persona}_${Date.now()}`;
      }

      const conversationRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
      const conversationDoc = await conversationRef.get();

      if (conversationDoc.exists) {
        return conversationDoc.data() as ConversationContext;
      }

      // Create new conversation context
      const newContext: ConversationContext = {
        userId,
        persona,
        conversationId,
        messageHistory: [],
        userPreferences: {
          favoriteTeams: partialContext.userPreferences?.favoriteTeams || [],
          riskTolerance: partialContext.userPreferences?.riskTolerance || "moderate",
          experienceLevel: partialContext.userPreferences?.experienceLevel || "intermediate"
        },
        currentWeek: this.getCurrentWeek(),
        season: this.getCurrentSeason()
      };

      await conversationRef.set(newContext);
      return newContext;

    } catch (error) {
      functions.logger.error("Conversation context error:", error);
      throw new Error(`Failed to get conversation context: ${error}`);
    }
  }

  /**
   * Update conversation history
   */
  static async updateConversationHistory(
    conversationId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    try {
      const conversationRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
      
      await conversationRef.update({
        messageHistory: admin.firestore.FieldValue.arrayUnion(
          {
            role: "user",
            content: userMessage,
            timestamp: new Date()
          },
          {
            role: "assistant", 
            content: assistantResponse,
            timestamp: new Date()
          }
        ),
        updatedAt: new Date()
      });

    } catch (error) {
      functions.logger.error("Update conversation history error:", error);
    }
  }

  /**
   * Update user usage statistics
   */
  static async updateUserUsage(userId: string): Promise<void> {
    try {
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      const now = new Date();
      const lastReset = userData?.usage?.lastResetDate?.toDate() || new Date(0);
      const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

      if (isNewMonth) {
        // Reset monthly usage
        await userRef.update({
          "usage.conversationsThisMonth": 1,
          "usage.lastResetDate": now,
          updatedAt: now
        });
      } else {
        // Increment usage
        await userRef.update({
          "usage.conversationsThisMonth": admin.firestore.FieldValue.increment(1),
          updatedAt: now
        });
      }

    } catch (error) {
      functions.logger.error("Update user usage error:", error);
    }
  }

  /**
   * Helper methods
   */
  static getPersonaTemperature(persona: PersonaType): number {
    const temperatureMap = {
      ORACLE: 0.8,    // More creative/mystical
      REBEL: 0.9,     // Most creative/unpredictable
      MENTOR: 0.4,    // More consistent/reliable
      ANALYST: 0.2,   // Most consistent/factual
      ROOKIE: 0.7,    // Enthusiastic but variable
      ZANE: 0.6       // Professional but engaging
    };
    return temperatureMap[persona] || 0.5;
  }

  static extractPlayerMentions(query: string): string[] {
    // Simple player extraction (in production, use NLP or player database lookup)
    const playerPattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    return query.match(playerPattern) || [];
  }

  static extractTeamMentions(query: string): string[] {
    const teams = ["Chiefs", "Bills", "Cowboys", "49ers", "Eagles", "Dolphins", "Ravens", "Bengals"];
    return teams.filter(team => query.toLowerCase().includes(team.toLowerCase()));
  }

  static classifyQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes("start") || lowerQuery.includes("sit")) return "start_sit";
    if (lowerQuery.includes("trade")) return "trade";
    if (lowerQuery.includes("waiver") || lowerQuery.includes("pickup")) return "waiver";
    if (lowerQuery.includes("lineup")) return "lineup";
    if (lowerQuery.includes("draft")) return "draft";
    return "general";
  }

  static generatePersonaInsights(persona: PersonaType, data: any): any {
    // Generate persona-specific insights based on their data weighting preferences
    const insights = {
      persona_focus: PERSONA_CONFIGS[persona].name,
      key_factors: Object.keys(PERSONA_CONFIGS[persona].dataWeighting),
      confidence_level: this.calculateConfidenceLevel(persona, data)
    };

    return insights;
  }

  static calculateConfidenceLevel(persona: PersonaType, data: any): string {
    // Simple confidence calculation based on data availability
    const dataQuality = Object.keys(data).length;
    if (dataQuality > 4) return "high";
    if (dataQuality > 2) return "medium";
    return "low";
  }

  static getCurrentWeek(): number {
    // Calculate current NFL week (simplified)
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // September 1st
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(18, weeksSinceStart + 1));
  }

  static getCurrentSeason(): string {
    const now = new Date();
    return now.getMonth() >= 8 ? now.getFullYear().toString() : (now.getFullYear() - 1).toString();
  }
}

