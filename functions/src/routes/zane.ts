import * as functions from "firebase-functions";
import * as express from "express";
import * as cors from "cors";
import { ZaneReporterService } from "../services/zane-reporter";
import { authenticateUser, AuthenticatedRequest, requireSubscriptionTier } from "../middleware/auth";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * Get daily fantasy briefing
 */
app.get("/briefing", authenticateUser, requireSubscriptionTier(["pro", "champion"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { date } = req.query;
    
    let briefing;
    if (date) {
      // Get specific date briefing
      const briefingDoc = await ZaneReporterService.db.collection("daily_briefings")
        .doc(`briefing_${date}`)
        .get();
      
      if (briefingDoc.exists) {
        briefing = briefingDoc.data();
      } else {
        // Generate briefing for requested date
        briefing = await ZaneReporterService.generateDailyBriefing(date as string);
      }
    } else {
      // Get today's briefing or generate if doesn't exist
      const today = new Date().toISOString().split("T")[0];
      const todayBriefingDoc = await ZaneReporterService.db.collection("daily_briefings")
        .doc(`briefing_${today}`)
        .get();
      
      if (todayBriefingDoc.exists) {
        briefing = todayBriefingDoc.data();
      } else {
        briefing = await ZaneReporterService.generateDailyBriefing();
      }
    }

    res.json({
      success: true,
      briefing
    });

  } catch (error) {
    functions.logger.error("Get briefing error:", error);
    res.status(500).json({ error: "Failed to get daily briefing" });
  }
});

/**
 * Get breaking news
 */
app.get("/breaking-news", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 10, hours = 24 } = req.query;
    
    const cutoff = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);
    
    const newsSnapshot = await ZaneReporterService.db.collection("breaking_news")
      .where("timestamp", ">=", cutoff)
      .orderBy("timestamp", "desc")
      .limit(parseInt(limit as string))
      .get();

    const news = newsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      news,
      count: news.length
    });

  } catch (error) {
    functions.logger.error("Get breaking news error:", error);
    res.status(500).json({ error: "Failed to get breaking news" });
  }
});

/**
 * Get specific news item
 */
app.get("/news/:newsId", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { newsId } = req.params;
    
    const newsDoc = await ZaneReporterService.db.collection("breaking_news")
      .doc(newsId)
      .get();

    if (!newsDoc.exists) {
      return res.status(404).json({ error: "News item not found" });
    }

    res.json({
      success: true,
      news: {
        id: newsDoc.id,
        ...newsDoc.data()
      }
    });

  } catch (error) {
    functions.logger.error("Get news item error:", error);
    res.status(500).json({ error: "Failed to get news item" });
  }
});

/**
 * Submit breaking news for analysis (admin/webhook endpoint)
 */
app.post("/analyze-news", async (req, res) => {
  try {
    const { headline, content, source, apiKey } = req.body;

    // Simple API key validation (in production, use proper authentication)
    const validApiKey = functions.config().zane?.api_key || process.env.ZANE_API_KEY;
    if (apiKey !== validApiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (!headline || !content) {
      return res.status(400).json({ error: "Headline and content are required" });
    }

    const newsItem = await ZaneReporterService.analyzeBreakingNews(
      headline,
      content,
      source || "API"
    );

    res.json({
      success: true,
      newsItem: {
        id: newsItem.id,
        headline: newsItem.headline,
        category: newsItem.category,
        fantasyImpact: newsItem.fantasyImpact,
        urgency: newsItem.urgency,
        affectedPlayers: newsItem.affectedPlayers,
        zaneAnalysis: newsItem.zaneAnalysis
      }
    });

  } catch (error) {
    functions.logger.error("Analyze news error:", error);
    res.status(500).json({ error: "Failed to analyze news" });
  }
});

/**
 * Generate live game update
 */
app.post("/live-update", requireSubscriptionTier(["champion"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { gameId, playData } = req.body;

    if (!gameId || !playData) {
      return res.status(400).json({ error: "Game ID and play data are required" });
    }

    const update = await ZaneReporterService.generateLiveGameUpdate(gameId, playData);

    res.json({
      success: true,
      update
    });

  } catch (error) {
    functions.logger.error("Live update error:", error);
    res.status(500).json({ error: "Failed to generate live update" });
  }
});

/**
 * Get news by category
 */
app.get("/news/category/:category", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;

    const validCategories = ["injury", "trade", "suspension", "depth_chart", "performance", "breaking"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const newsSnapshot = await ZaneReporterService.db.collection("breaking_news")
      .where("category", "==", category)
      .orderBy("timestamp", "desc")
      .limit(parseInt(limit as string))
      .get();

    const news = newsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      category,
      news,
      count: news.length
    });

  } catch (error) {
    functions.logger.error("Get news by category error:", error);
    res.status(500).json({ error: "Failed to get news by category" });
  }
});

/**
 * Get high-impact news (fantasy impact >= 7)
 */
app.get("/high-impact", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 5 } = req.query;

    const newsSnapshot = await ZaneReporterService.db.collection("breaking_news")
      .where("fantasyImpact", ">=", 7)
      .orderBy("fantasyImpact", "desc")
      .orderBy("timestamp", "desc")
      .limit(parseInt(limit as string))
      .get();

    const news = newsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      news,
      count: news.length
    });

  } catch (error) {
    functions.logger.error("Get high-impact news error:", error);
    res.status(500).json({ error: "Failed to get high-impact news" });
  }
});

/**
 * Get news affecting specific player
 */
app.get("/player/:playerName/news", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { playerName } = req.params;
    const { limit = 10 } = req.query;

    const newsSnapshot = await ZaneReporterService.db.collection("breaking_news")
      .where("affectedPlayers", "array-contains", playerName)
      .orderBy("timestamp", "desc")
      .limit(parseInt(limit as string))
      .get();

    const news = newsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      player: playerName,
      news,
      count: news.length
    });

  } catch (error) {
    functions.logger.error("Get player news error:", error);
    res.status(500).json({ error: "Failed to get player news" });
  }
});

/**
 * Get Zane's voice briefing
 */
app.get("/voice-briefing", authenticateUser, requireSubscriptionTier(["pro", "champion"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { date } = req.query;
    const briefingDate = date || new Date().toISOString().split("T")[0];
    
    const briefingDoc = await ZaneReporterService.db.collection("daily_briefings")
      .doc(`briefing_${briefingDate}`)
      .get();

    if (!briefingDoc.exists) {
      return res.status(404).json({ error: "Briefing not found for this date" });
    }

    const briefing = briefingDoc.data();
    
    if (!briefing?.voiceBriefing) {
      return res.status(404).json({ error: "Voice briefing not available" });
    }

    res.json({
      success: true,
      voiceBriefing: briefing.voiceBriefing,
      date: briefingDate,
      duration: "estimated 3-5 minutes"
    });

  } catch (error) {
    functions.logger.error("Get voice briefing error:", error);
    res.status(500).json({ error: "Failed to get voice briefing" });
  }
});

export const zaneRoutes = functions.https.onRequest(app);

