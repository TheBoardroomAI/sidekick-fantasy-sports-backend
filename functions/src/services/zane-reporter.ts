import * as functions from "firebase-functions/v1";
import { db } from "../config/firebase";
import { DataIntegrationService } from "./data-integration";
import { VoiceSystemService } from "./voice-system";
import { RealtimeSystemService } from "./realtime-system";
import { PersonaEngineService } from "./persona-engine";

export interface NewsItem {
  id: string;
  headline: string;
  content: string;
  category: "injury" | "trade" | "suspension" | "depth_chart" | "performance" | "breaking";
  fantasyImpact: number; // 1-10 scale
  affectedPlayers: string[];
  affectedTeams: string[];
  urgency: "low" | "medium" | "high" | "urgent";
  source: string;
  timestamp: Date;
  zaneAnalysis?: string;
  voiceReport?: string;
}

export interface DailyBriefing {
  id: string;
  date: string;
  topStories: NewsItem[];
  startEmSitEm: {
    starts: Array<{ player: string; reason: string; confidence: number }>;
    sits: Array<{ player: string; reason: string; confidence: number }>;
  };
  sleeperAlerts: Array<{ player: string; reason: string; upside: string }>;
  weatherWatch: Array<{ game: string; conditions: string; impact: string }>;
  injuryReport: Array<{ player: string; status: string; timeline: string; impact: number }>;
  zaneCommentary: string;
  voiceBriefing?: string;
  createdAt: Date;
}

export class ZaneReporterService {
  // Export db for route access
  static db = db;

  /**
   * Generate breaking news analysis
   */
  static async analyzeBreakingNews(
    headline: string,
    content: string,
    source: string = "API"
  ): Promise<NewsItem> {
    try {
      // Extract affected players and teams
      const affectedPlayers = this.extractPlayersFromNews(content);
      const affectedTeams = this.extractTeamsFromNews(content);
      
      // Classify news category
      const category = this.classifyNewsCategory(headline, content);
      
      // Calculate fantasy impact score
      const fantasyImpact = await this.calculateFantasyImpact(content, affectedPlayers, category);
      
      // Determine urgency level
      const urgency = this.determineUrgency(category, fantasyImpact);

      // Generate Zane's analysis
      const zaneAnalysis = await PersonaEngineService.generatePersonaResponse(
        "ZANE",
        `Analyze this breaking news for fantasy impact: ${headline}. ${content}`,
        {
          userId: "system",
          persona: "ZANE",
          conversationId: "zane_news_analysis",
          messageHistory: [],
          userPreferences: {
            favoriteTeams: [],
            riskTolerance: "moderate",
            experienceLevel: "expert"
          },
          currentWeek: PersonaEngineService.getCurrentWeek(),
          season: PersonaEngineService.getCurrentSeason()
        },
        { news_content: content, affected_players: affectedPlayers }
      );

      const newsItem: NewsItem = {
        id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        headline,
        content,
        category,
        fantasyImpact,
        affectedPlayers,
        affectedTeams,
        urgency,
        source,
        timestamp: new Date(),
        zaneAnalysis
      };

      // Generate voice report for high-impact news
      if (fantasyImpact >= 7) {
        const voiceResult = await VoiceSystemService.generateSpeech(
          `Breaking news alert! ${headline}. ${zaneAnalysis}`,
          "ZANE"
        );
        newsItem.voiceReport = voiceResult.audioData;
      }

      // Save to database
      await db.collection("breaking_news").doc(newsItem.id).set(newsItem);

      // Broadcast urgent news via real-time
      if (urgency === "urgent") {
        await RealtimeSystemService.triggerEvent(
          "breaking-news",
          "urgent-news",
          {
            newsItem,
            timestamp: new Date().toISOString()
          }
        );
      }

      return newsItem;

    } catch (error: any) {
      functions.logger.error("Breaking news analysis error:", error);
      throw new Error(`Failed to analyze breaking news: ${error}`);
    }
  }

  /**
   * Generate daily fantasy briefing
   */
  static async generateDailyBriefing(date?: string): Promise<DailyBriefing> {
    try {
      const briefingDate = date || new Date().toISOString().split("T")[0];
      
      // Get recent breaking news
      const recentNews = await this.getRecentBreakingNews(24); // Last 24 hours
      
      // Get top stories (highest fantasy impact)
      const topStories = recentNews
        .sort((a, b) => b.fantasyImpact - a.fantasyImpact)
        .slice(0, 5);

      // Generate Start 'Em / Sit 'Em recommendations
      const startEmSitEm = await this.generateStartSitRecommendations();
      
      // Generate sleeper alerts
      const sleeperAlerts = await this.generateSleeperAlerts();
      
      // Get weather watch
      const weatherWatch = await this.getWeatherWatch();
      
      // Get injury report
      const injuryReport = await this.getInjuryReport();

      // Generate Zane's daily commentary
      const zaneCommentary = await PersonaEngineService.generatePersonaResponse(
        "ZANE",
        `Provide your daily fantasy football briefing for ${briefingDate}. Cover the top stories, key matchups, and what fantasy managers need to know today.`,
        {
          userId: "system",
          persona: "ZANE", 
          conversationId: "zane_daily_briefing",
          messageHistory: [],
          userPreferences: {
            favoriteTeams: [],
            riskTolerance: "moderate",
            experienceLevel: "expert"
          },
          currentWeek: PersonaEngineService.getCurrentWeek(),
          season: PersonaEngineService.getCurrentSeason()
        },
        {
          top_stories: topStories,
          start_sit: startEmSitEm,
          sleepers: sleeperAlerts,
          weather: weatherWatch,
          injuries: injuryReport
        }
      );

      const briefing: DailyBriefing = {
        id: `briefing_${briefingDate}`,
        date: briefingDate,
        topStories,
        startEmSitEm,
        sleeperAlerts,
        weatherWatch,
        injuryReport,
        zaneCommentary,
        createdAt: new Date()
      };

      // Generate voice briefing
      const fullBriefingText = this.compileBriefingText(briefing);
      const voiceResult = await VoiceSystemService.generateSpeech(fullBriefingText, "ZANE");
      briefing.voiceBriefing = voiceResult.audioData;

      // Save briefing
      await db.collection("daily_briefings").doc(briefing.id).set(briefing);

      // Broadcast briefing availability
      await RealtimeSystemService.triggerEvent(
        "daily-briefing",
        "briefing-ready",
        {
          briefingId: briefing.id,
          date: briefingDate,
          topStoriesCount: topStories.length
        }
      );

      return briefing;

    } catch (error: any) {
      functions.logger.error("Daily briefing error:", error);
      throw new Error(`Failed to generate daily briefing: ${error}`);
    }
  }

  /**
   * Generate live game update
   */
  static async generateLiveGameUpdate(
    gameId: string,
    playData: any
  ): Promise<{ update: string; voiceUpdate?: string }> {
    try {
      // Analyze play for fantasy relevance
      const fantasyRelevance = this.analyzePlayFantasyRelevance(playData);
      
      if (fantasyRelevance.score < 5) {
        return { update: "" }; // Skip low-relevance plays
      }

      // Generate Zane's live commentary
      const liveUpdate = await PersonaEngineService.generatePersonaResponse(
        "ZANE",
        `Provide live fantasy football commentary for this play: ${JSON.stringify(playData)}. Focus on fantasy impact and excitement.`,
        {
          userId: "system",
          persona: "ZANE",
          conversationId: `zane_live_${gameId}`,
          messageHistory: [],
          userPreferences: {
            favoriteTeams: [],
            riskTolerance: "moderate", 
            experienceLevel: "expert"
          },
          currentWeek: PersonaEngineService.getCurrentWeek(),
          season: PersonaEngineService.getCurrentSeason()
        },
        { play_data: playData, fantasy_relevance: fantasyRelevance }
      );

      let voiceUpdate;
      if (fantasyRelevance.score >= 8) {
        // Generate voice for high-impact plays
        const voiceResult = await VoiceSystemService.generateSpeech(liveUpdate, "ZANE");
        voiceUpdate = voiceResult.audioData;
      }

      // Broadcast live update
      await RealtimeSystemService.triggerEvent(
        `game-${gameId}`,
        "live-update",
        {
          update: liveUpdate,
          fantasyRelevance: fantasyRelevance.score,
          timestamp: new Date().toISOString()
        }
      );

      return { update: liveUpdate, voiceUpdate };

    } catch (error: any) {
      functions.logger.error("Live game update error:", error);
      throw new Error(`Failed to generate live update: ${error}`);
    }
  }

  /**
   * Monitor news feeds for breaking stories
   */
  static async monitorNewsFeeds(): Promise<void> {
    try {
      // This would integrate with news APIs or RSS feeds
      // For now, simulate with data from our sports APIs
      
      await DataIntegrationService.getTrendingPlayers();
      
      // Check for significant changes that warrant news alerts
      // This is a simplified version - production would have more sophisticated monitoring
      
      functions.logger.info("News monitoring completed", { 
        timestamp: new Date().toISOString() 
      });

    } catch (error: any) {
      functions.logger.error("News monitoring error:", error);
    }
  }

  /**
   * Helper methods
   */
  static extractPlayersFromNews(content: string): string[] {
    // Extract player names from news content
    const playerPattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    const matches = content.match(playerPattern) || [];
    
    // Filter out common false positives
    const excludeWords = ["New York", "Los Angeles", "Green Bay", "New England"];
    return matches.filter(match => !excludeWords.includes(match));
  }

  static extractTeamsFromNews(content: string): string[] {
    const teams = [
      "Chiefs", "Bills", "Cowboys", "49ers", "Eagles", "Dolphins", "Ravens", "Bengals",
      "Chargers", "Jaguars", "Jets", "Giants", "Steelers", "Lions", "Packers", "Vikings"
    ];
    return teams.filter(team => content.toLowerCase().includes(team.toLowerCase()));
  }

  static classifyNewsCategory(headline: string, content: string): NewsItem["category"] {
    const text = (headline + " " + content).toLowerCase();
    
    if (text.includes("injur") || text.includes("hurt") || text.includes("questionable")) return "injury";
    if (text.includes("trade") || text.includes("acquire")) return "trade";
    if (text.includes("suspend") || text.includes("fine")) return "suspension";
    if (text.includes("depth") || text.includes("starter") || text.includes("backup")) return "depth_chart";
    if (text.includes("touchdown") || text.includes("yards") || text.includes("stats")) return "performance";
    
    return "breaking";
  }

  static async calculateFantasyImpact(
    content: string,
    affectedPlayers: string[],
    category: NewsItem["category"]
  ): Promise<number> {
    // Simplified fantasy impact calculation
    let baseScore = 5;
    
    // Category modifiers
    const categoryModifiers = {
      injury: 8,
      trade: 7,
      suspension: 6,
      depth_chart: 5,
      performance: 4,
      breaking: 6
    };
    
    baseScore = categoryModifiers[category];
    
    // Player count modifier
    if (affectedPlayers.length > 2) baseScore += 1;
    
    // Content analysis modifiers
    if (content.toLowerCase().includes("out for season")) baseScore = 10;
    if (content.toLowerCase().includes("questionable")) baseScore += 1;
    if (content.toLowerCase().includes("probable")) baseScore -= 1;
    
    return Math.min(10, Math.max(1, baseScore));
  }

  static determineUrgency(category: NewsItem["category"], fantasyImpact: number): NewsItem["urgency"] {
    if (fantasyImpact >= 9) return "urgent";
    if (fantasyImpact >= 7) return "high";
    if (fantasyImpact >= 5) return "medium";
    return "low";
  }

  static async getRecentBreakingNews(hours: number): Promise<NewsItem[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const snapshot = await db.collection("breaking_news")
      .where("timestamp", ">=", cutoff)
      .orderBy("timestamp", "desc")
      .get();
    
    return snapshot.docs.map(doc => doc.data() as NewsItem);
  }

  static async generateStartSitRecommendations(): Promise<DailyBriefing["startEmSitEm"]> {
    // Simplified recommendations - would use real player analysis
    return {
      starts: [
        { player: "Josh Allen", reason: "Favorable matchup vs weak secondary", confidence: 9 },
        { player: "Christian McCaffrey", reason: "High volume expected in potential shootout", confidence: 8 }
      ],
      sits: [
        { player: "Player X", reason: "Tough matchup against top-ranked defense", confidence: 7 }
      ]
    };
  }

  static async generateSleeperAlerts(): Promise<DailyBriefing["sleeperAlerts"]> {
    return [
      { player: "Sleeper Player", reason: "Increased target share with WR1 out", upside: "WR2 potential" }
    ];
  }

  static async getWeatherWatch(): Promise<DailyBriefing["weatherWatch"]> {
    return [
      { game: "Bills @ Dolphins", conditions: "Heavy rain expected", impact: "Lower passing volume likely" }
    ];
  }

  static async getInjuryReport(): Promise<DailyBriefing["injuryReport"]> {
    return [
      { player: "Star Player", status: "Questionable", timeline: "Game-time decision", impact: 8 }
    ];
  }

  static analyzePlayFantasyRelevance(playData: any): { score: number; reasons: string[] } {
    let score = 1;
    const reasons = [];
    
    // Analyze play type, players involved, yardage, etc.
    if (playData.touchdown) {
      score += 5;
      reasons.push("Touchdown scored");
    }
    
    if (playData.yards > 20) {
      score += 2;
      reasons.push("Big play");
    }
    
    return { score: Math.min(10, score), reasons };
  }

  static compileBriefingText(briefing: DailyBriefing): string {
    return `Good morning fantasy managers! This is Zane with your daily fantasy football briefing for ${briefing.date}. 

${briefing.zaneCommentary}

Here are today's top stories: ${briefing.topStories.map(story => story.headline).join(". ")}

For your lineups today: Start ${briefing.startEmSitEm.starts.map(s => s.player).join(", ")}. Consider sitting ${briefing.startEmSitEm.sits.map(s => s.player).join(", ")}.

Keep an eye on these sleeper picks: ${briefing.sleeperAlerts.map(s => s.player).join(", ")}.

That's your briefing for today. Good luck with your lineups!`;
  }
}

