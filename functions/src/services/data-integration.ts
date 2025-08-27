import axios from "axios";
import * as functions from "firebase-functions/v1";
import { db, COLLECTIONS } from "../config/firebase";

// API Configuration
const TANK01_API_KEY = functions.config().tank01?.api_key || process.env.TANK01_API_KEY;
const MYSPORTSFEEDS_API_KEY = functions.config().mysportsfeeds?.api_key || process.env.MYSPORTSFEEDS_API_KEY;

export class DataIntegrationService {

  /**
   * Tank01 API Integration - $25/month ULTRA plan
   */
  static async getTank01PlayerData(playerId?: string): Promise<any> {
    try {
      const baseUrl = "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
      const endpoint = playerId ? `/getNFLPlayerInfo?playerID=${playerId}` : "/getNFLPlayerList";
      
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          "X-RapidAPI-Key": TANK01_API_KEY,
          "X-RapidAPI-Host": "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com"
        }
      });

      return response.data;
    } catch (error: any) {
      functions.logger.error("Tank01 API error:", error);
      throw new Error(`Tank01 API request failed: ${error}`);
    }
  }

  /**
   * Get NFL team data from Tank01
   */
  static async getTank01TeamData(): Promise<any> {
    try {
      const baseUrl = "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
      
      const response = await axios.get(`${baseUrl}/getNFLTeams`, {
        headers: {
          "X-RapidAPI-Key": TANK01_API_KEY,
          "X-RapidAPI-Host": "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com"
        }
      });

      return response.data;
    } catch (error: any) {
      functions.logger.error("Tank01 teams API error:", error);
      throw new Error(`Tank01 teams API request failed: ${error}`);
    }
  }

  /**
   * Get live game data from Tank01
   */
  static async getTank01GameData(gameId?: string): Promise<any> {
    try {
      const baseUrl = "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
      const endpoint = gameId ? `/getNFLGamesForDate?gameDate=${gameId}` : "/getNFLGamesForDate";
      
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          "X-RapidAPI-Key": TANK01_API_KEY,
          "X-RapidAPI-Host": "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com"
        }
      });

      return response.data;
    } catch (error: any) {
      functions.logger.error("Tank01 games API error:", error);
      throw new Error(`Tank01 games API request failed: ${error}`);
    }
  }

  /**
   * MySportsFeeds API Integration - $39/month plan
   */
  static async getMySportsFeedsData(endpoint: string): Promise<any> {
    try {
      const baseUrl = "https://api.mysportsfeeds.com/v2.1/pull/nfl";
      
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${MYSPORTSFEEDS_API_KEY}:MYSPORTSFEEDS`).toString("base64")}`
        }
      });

      return response.data;
    } catch (error: any) {
      functions.logger.error("MySportsFeeds API error:", error);
      throw new Error(`MySportsFeeds API request failed: ${error}`);
    }
  }

  /**
   * Get player stats from MySportsFeeds
   */
  static async getPlayerStats(season: string = "current"): Promise<any> {
    return this.getMySportsFeedsData(`/${season}/player_stats_totals.json`);
  }

  /**
   * Get team standings from MySportsFeeds
   */
  static async getTeamStandings(season: string = "current"): Promise<any> {
    return this.getMySportsFeedsData(`/${season}/standings.json`);
  }

  /**
   * NFLverse API Integration - Free tier
   */
  static async getNFLverseData(endpoint: string): Promise<any> {
    try {
      const baseUrl = "https://api.nflverse.com/v1/nfl";
      
      const response = await axios.get(`${baseUrl}${endpoint}`);
      return response.data;
    } catch (error: any) {
      functions.logger.error("NFLverse API error:", error);
      throw new Error(`NFLverse API request failed: ${error}`);
    }
  }

  /**
   * Get advanced player metrics from NFLverse
   */
  static async getAdvancedPlayerMetrics(): Promise<any> {
    return this.getNFLverseData("/player_stats");
  }

  /**
   * Get EPA (Expected Points Added) data
   */
  static async getEPAData(): Promise<any> {
    return this.getNFLverseData("/pbp");
  }

  /**
   * Unified player data aggregation
   */
  static async getUnifiedPlayerData(playerId: string): Promise<any> {
    try {
      const [tank01Data, nflverseData] = await Promise.allSettled([
        this.getTank01PlayerData(playerId),
        this.getAdvancedPlayerMetrics()
      ]);

      const unifiedData = {
        playerId,
        timestamp: new Date().toISOString(),
        sources: {
          tank01: tank01Data.status === "fulfilled" ? tank01Data.value : null,
          nflverse: nflverseData.status === "fulfilled" ? nflverseData.value : null
        },
        processed: {
          // Will be enhanced with persona-specific data processing
          basicStats: {},
          advancedMetrics: {},
          fantasyRelevance: {}
        }
      };

      // Cache the unified data
      await this.cachePlayerData(playerId, unifiedData);
      
      return unifiedData;
    } catch (error: any) {
      functions.logger.error("Unified player data error:", error);
      throw new Error(`Failed to get unified player data: ${error}`);
    }
  }

  /**
   * Cache player data in Firestore
   */
  static async cachePlayerData(playerId: string, data: any): Promise<void> {
    try {
      await db.collection(COLLECTIONS.PLAYER_DATA).doc(playerId).set({
        ...data,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000) // 1 hour cache
      });
    } catch (error: any) {
      functions.logger.error("Cache player data error:", error);
    }
  }

  /**
   * Get cached player data
   */
  static async getCachedPlayerData(playerId: string): Promise<any | null> {
    try {
      const doc = await db.collection(COLLECTIONS.PLAYER_DATA).doc(playerId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      const now = new Date();
      
      // Check if cache is expired
      if (data?.expiresAt && data.expiresAt.toDate() < now) {
        return null;
      }

      return data;
    } catch (error: any) {
      functions.logger.error("Get cached player data error:", error);
      return null;
    }
  }

  /**
   * Get player data with caching
   */
  static async getPlayerDataWithCache(playerId: string): Promise<any> {
    // Try cache first
    const cachedData = await this.getCachedPlayerData(playerId);
    if (cachedData) {
      return cachedData;
    }

    // Fetch fresh data if not cached
    return this.getUnifiedPlayerData(playerId);
  }

  /**
   * Get trending players data
   */
  static async getTrendingPlayers(): Promise<any> {
    try {
      // Combine data from multiple sources for trending analysis
      const [tank01Players, nflverseStats] = await Promise.allSettled([
        this.getTank01PlayerData(),
        this.getAdvancedPlayerMetrics()
      ]);

      return {
        trending: {
          risers: [],
          fallers: [],
          breakouts: []
        },
        sources: {
          tank01: tank01Players.status === "fulfilled" ? tank01Players.value : null,
          nflverse: nflverseStats.status === "fulfilled" ? nflverseStats.value : null
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error: any) {
      functions.logger.error("Trending players error:", error);
      throw new Error(`Failed to get trending players: ${error}`);
    }
  }

  /**
   * Health check for all data sources
   */
  static async healthCheck(): Promise<any> {
    const results = {
      tank01: { status: "unknown", latency: 0 },
      mysportsfeeds: { status: "unknown", latency: 0 },
      nflverse: { status: "unknown", latency: 0 }
    };

    // Test Tank01
    try {
      const start = Date.now();
      await this.getTank01TeamData();
      results.tank01 = { status: "healthy", latency: Date.now() - start };
    } catch (error: any) {
      results.tank01 = { status: "error", latency: 0, message: error?.message || "Unknown error" };
    }

    // Test MySportsFeeds
    try {
      const start = Date.now();
      await this.getTeamStandings();
      results.mysportsfeeds = { status: "healthy", latency: Date.now() - start };
    } catch (error: any) {
      results.mysportsfeeds = { status: "error", latency: 0, message: error?.message || "Unknown error" };
    }

    // Test NFLverse
    try {
      const start = Date.now();
      await this.getAdvancedPlayerMetrics();
      results.nflverse = { status: "healthy", latency: Date.now() - start };
    } catch (error: any) {
      results.nflverse = { status: "error", latency: 0, message: error?.message || "Unknown error" };
    }

    return results;
  }
}

