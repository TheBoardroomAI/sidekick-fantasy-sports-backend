import * as functions from "firebase-functions";
import * as express from "express";
import * as cors from "cors";
import { PersonaEngineService, PersonaType } from "../services/persona-engine";
import { authenticateUser, AuthenticatedRequest, requireActiveSubscription } from "../middleware/auth";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * Chat with a specific AI persona
 */
app.post("/chat/:persona", authenticateUser, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  try {
    const { persona } = req.params;
    const { message, conversationId, userPreferences } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Validate persona
    const validPersonas = ["ORACLE", "REBEL", "MENTOR", "ANALYST", "ROOKIE", "ZANE"];
    if (!validPersonas.includes(persona.toUpperCase())) {
      return res.status(400).json({ error: "Invalid persona" });
    }

    const response = await PersonaEngineService.processPersonaQuery(
      req.user!.uid,
      persona.toUpperCase() as PersonaType,
      message,
      {
        conversationId,
        userPreferences
      }
    );

    res.json({
      success: true,
      response: {
        text: response.textResponse,
        audio: response.audioResponse,
        conversationId: response.conversationId,
        persona: persona.toUpperCase(),
        timestamp: new Date().toISOString()
      },
      dataUsed: response.dataUsed
    });

  } catch (error) {
    functions.logger.error("Persona chat error:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

/**
 * Get conversation history
 */
app.get("/conversation/:conversationId", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    
    // Verify user owns this conversation
    if (!conversationId.startsWith(req.user!.uid)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const conversationDoc = await PersonaEngineService.db.collection("conversations")
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const conversation = conversationDoc.data();
    
    res.json({
      success: true,
      conversation: {
        id: conversationId,
        persona: conversation?.persona,
        messageHistory: conversation?.messageHistory || [],
        createdAt: conversation?.createdAt,
        updatedAt: conversation?.updatedAt
      }
    });

  } catch (error) {
    functions.logger.error("Get conversation error:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

/**
 * Get user's conversations
 */
app.get("/conversations", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 20, persona } = req.query;

    let query = PersonaEngineService.db.collection("conversations")
      .where("userId", "==", req.user!.uid)
      .orderBy("updatedAt", "desc")
      .limit(parseInt(limit as string));

    if (persona) {
      query = query.where("persona", "==", (persona as string).toUpperCase());
    }

    const snapshot = await query.get();
    
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      persona: doc.data().persona,
      lastMessage: doc.data().messageHistory?.slice(-1)[0]?.content || "",
      messageCount: doc.data().messageHistory?.length || 0,
      updatedAt: doc.data().updatedAt,
      createdAt: doc.data().createdAt
    }));

    res.json({
      success: true,
      conversations
    });

  } catch (error) {
    functions.logger.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

/**
 * Get available personas for user's subscription tier
 */
app.get("/personas", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userDoc = await PersonaEngineService.db.collection("users")
      .doc(req.user!.uid)
      .get();
    
    const userData = userDoc.data();
    const subscriptionTier = userData?.subscriptionTier || "rookie";

    // Define persona access by tier
    const personaAccess = {
      rookie: ["ROOKIE"],
      pro: ["ROOKIE", "ORACLE", "REBEL", "MENTOR"],
      champion: ["ROOKIE", "ORACLE", "REBEL", "MENTOR", "ANALYST", "ZANE"]
    };

    const availablePersonas = personaAccess[subscriptionTier as keyof typeof personaAccess] || ["ROOKIE"];
    
    const personas = availablePersonas.map(persona => ({
      id: persona,
      name: PersonaEngineService.PERSONA_CONFIGS[persona as PersonaType].name,
      personality: PersonaEngineService.PERSONA_CONFIGS[persona as PersonaType].personality,
      available: true
    }));

    // Add locked personas for upgrade prompts
    const allPersonas = ["ROOKIE", "ORACLE", "REBEL", "MENTOR", "ANALYST", "ZANE"];
    const lockedPersonas = allPersonas.filter(p => !availablePersonas.includes(p));
    
    lockedPersonas.forEach(persona => {
      personas.push({
        id: persona,
        name: PersonaEngineService.PERSONA_CONFIGS[persona as PersonaType].name,
        personality: PersonaEngineService.PERSONA_CONFIGS[persona as PersonaType].personality,
        available: false
      });
    });

    res.json({
      success: true,
      subscriptionTier,
      personas
    });

  } catch (error) {
    functions.logger.error("Get personas error:", error);
    res.status(500).json({ error: "Failed to get personas" });
  }
});

/**
 * Delete conversation
 */
app.delete("/conversation/:conversationId", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    
    // Verify user owns this conversation
    if (!conversationId.startsWith(req.user!.uid)) {
      return res.status(403).json({ error: "Access denied" });
    }

    await PersonaEngineService.db.collection("conversations")
      .doc(conversationId)
      .delete();

    res.json({
      success: true,
      message: "Conversation deleted"
    });

  } catch (error) {
    functions.logger.error("Delete conversation error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/**
 * Get persona statistics
 */
app.get("/stats", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const conversationsSnapshot = await PersonaEngineService.db.collection("conversations")
      .where("userId", "==", req.user!.uid)
      .get();

    const stats = {
      totalConversations: conversationsSnapshot.size,
      personaUsage: {} as Record<string, number>,
      totalMessages: 0,
      favoritePersona: "ROOKIE"
    };

    conversationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const persona = data.persona;
      const messageCount = data.messageHistory?.length || 0;
      
      stats.personaUsage[persona] = (stats.personaUsage[persona] || 0) + 1;
      stats.totalMessages += messageCount;
    });

    // Find favorite persona
    let maxUsage = 0;
    Object.entries(stats.personaUsage).forEach(([persona, usage]) => {
      if (usage > maxUsage) {
        maxUsage = usage;
        stats.favoritePersona = persona;
      }
    });

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    functions.logger.error("Get stats error:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

export const personaRoutes = functions.https.onRequest(app);

