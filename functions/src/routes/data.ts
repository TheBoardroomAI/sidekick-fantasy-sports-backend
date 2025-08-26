import * as functions from "firebase-functions";
import * as express from "express";
import * as cors from "cors";
import { DataIntegrationService } from "../services/data-integration";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * Get player data by ID
 */
app.get("/player/:playerId", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { playerId } = req.params;
    const playerData = await DataIntegrationService.getPlayerDataWithCache(playerId);
    
    res.json({
      success: true,
      data: playerData
    });

  } catch (error) {
    functions.logger.error("Player data error:", error);
    res.status(500).json({ error: "Failed to get player data" });
  }
});

/**
 * Get all players list
 */
app.get("/players", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const playersData = await DataIntegrationService.getTank01PlayerData();
    
    res.json({
      success: true,
      data: playersData
    });

  } catch (error) {
    functions.logger.error("Players list error:", error);
    res.status(500).json({ error: "Failed to get players list" });
  }
});

/**
 * Get team data
 */
app.get("/teams", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const teamsData = await DataIntegrationService.getTank01TeamData();
    
    res.json({
      success: true,
      data: teamsData
    });

  } catch (error) {
    functions.logger.error("Teams data error:", error);
    res.status(500).json({ error: "Failed to get teams data" });
  }
});

/**
 * Get game data
 */
app.get("/games", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { date } = req.query;
    const gamesData = await DataIntegrationService.getTank01GameData(date as string);
    
    res.json({
      success: true,
      data: gamesData
    });

  } catch (error) {
    functions.logger.error("Games data error:", error);
    res.status(500).json({ error: "Failed to get games data" });
  }
});

/**
 * Get player stats from MySportsFeeds
 */
app.get("/stats/players", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { season = "current" } = req.query;
    const statsData = await DataIntegrationService.getPlayerStats(season as string);
    
    res.json({
      success: true,
      data: statsData
    });

  } catch (error) {
    functions.logger.error("Player stats error:", error);
    res.status(500).json({ error: "Failed to get player stats" });
  }
});

/**
 * Get team standings
 */
app.get("/standings", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { season = "current" } = req.query;
    const standingsData = await DataIntegrationService.getTeamStandings(season as string);
    
    res.json({
      success: true,
      data: standingsData
    });

  } catch (error) {
    functions.logger.error("Standings error:", error);
    res.status(500).json({ error: "Failed to get standings" });
  }
});

/**
 * Get advanced metrics from NFLverse
 */
app.get("/metrics/advanced", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const metricsData = await DataIntegrationService.getAdvancedPlayerMetrics();
    
    res.json({
      success: true,
      data: metricsData
    });

  } catch (error) {
    functions.logger.error("Advanced metrics error:", error);
    res.status(500).json({ error: "Failed to get advanced metrics" });
  }
});

/**
 * Get EPA data
 */
app.get("/metrics/epa", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const epaData = await DataIntegrationService.getEPAData();
    
    res.json({
      success: true,
      data: epaData
    });

  } catch (error) {
    functions.logger.error("EPA data error:", error);
    res.status(500).json({ error: "Failed to get EPA data" });
  }
});

/**
 * Get trending players
 */
app.get("/trending", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const trendingData = await DataIntegrationService.getTrendingPlayers();
    
    res.json({
      success: true,
      data: trendingData
    });

  } catch (error) {
    functions.logger.error("Trending players error:", error);
    res.status(500).json({ error: "Failed to get trending players" });
  }
});

/**
 * Data sources health check
 */
app.get("/health", async (req, res) => {
  try {
    const healthData = await DataIntegrationService.healthCheck();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: healthData
    });

  } catch (error) {
    functions.logger.error("Data health check error:", error);
    res.status(500).json({ error: "Health check failed" });
  }
});

export const dataRoutes = functions.https.onRequest(app);

