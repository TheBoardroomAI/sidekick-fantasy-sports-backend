import * as functions from "firebase-functions/v1";
import express from "express";
import cors from "cors";
import { RealtimeSystemService } from "../services/realtime-system";
import { authenticateUser, AuthenticatedRequest, requireActiveSubscription } from "../middleware/auth";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * Create a new draft room
 */
app.post("/draft-room", authenticateUser, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId, settings } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const draftRoom = await RealtimeSystemService.createDraftRoom(
      roomId,
      req.user!.uid,
      settings || {}
    );

    return res.json({
      success: true,
      draftRoom
    });

  } catch (error: any) {
    functions.logger.error("Create draft room error:", error);
    return res.status(500).json({ error: "Failed to create draft room" });
  }
});

/**
 * Join a draft room
 */
app.post("/draft-room/:roomId/join", authenticateUser, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = req.params;

    const result = await RealtimeSystemService.joinDraftRoom(roomId, req.user!.uid);

    return res.json({
      success: true,
      result
    });

  } catch (error: any) {
    functions.logger.error("Join draft room error:", error);
    return res.status(500).json({ error: "Failed to join draft room" });
  }
});

/**
 * Start draft in a room
 */
app.post("/draft-room/:roomId/start", authenticateUser, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = req.params;

    const result = await RealtimeSystemService.startDraft(roomId, req.user!.uid);

    return res.json({
      success: true,
      result
    });

  } catch (error: any) {
    functions.logger.error("Start draft error:", error);
    return res.status(500).json({ error: "Failed to start draft" });
  }
});

/**
 * Make a draft pick
 */
app.post("/draft-room/:roomId/pick", authenticateUser, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = req.params;
    const { playerId, playerName } = req.body;

    if (!playerId || !playerName) {
      return res.status(400).json({ error: "Player ID and name are required" });
    }

    const result = await RealtimeSystemService.makeDraftPick(
      roomId,
      req.user!.uid,
      playerId,
      playerName
    );

    return res.json({
      success: true,
      result
    });

  } catch (error: any) {
    functions.logger.error("Make draft pick error:", error);
    return res.status(500).json({ error: "Failed to make draft pick" });
  }
});

/**
 * Send message to draft room
 */
app.post("/draft-room/:roomId/message", authenticateUser, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = req.params;
    const { message, messageType = "chat" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    await RealtimeSystemService.sendDraftMessage(
      roomId,
      req.user!.uid,
      message,
      messageType
    );

    return res.json({
      success: true,
      message: "Message sent"
    });

  } catch (error: any) {
    functions.logger.error("Send draft message error:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * Get draft room details
 */
app.get("/draft-room/:roomId", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = req.params;

    const roomDoc = await RealtimeSystemService.db.collection("draft_rooms")
      .doc(roomId)
      .get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: "Draft room not found" });
    }

    const roomData = roomDoc.data();

    // Check if user is participant
    if (!roomData?.participants.includes(req.user!.uid)) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      success: true,
      draftRoom: {
        roomId,
        ...roomData
      }
    });

  } catch (error: any) {
    functions.logger.error("Get draft room error:", error);
    return res.status(500).json({ error: "Failed to get draft room" });
  }
});

/**
 * Get draft room messages
 */
app.get("/draft-room/:roomId/messages", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50 } = req.query;

    // Verify user is in the room
    const roomDoc = await RealtimeSystemService.db.collection("draft_rooms")
      .doc(roomId)
      .get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: "Draft room not found" });
    }

    const roomData = roomDoc.data();
    if (!roomData?.participants.includes(req.user!.uid)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get messages
    const messagesSnapshot = await RealtimeSystemService.db.collection("draft_rooms")
      .doc(roomId)
      .collection("messages")
      .orderBy("timestamp", "desc")
      .limit(parseInt(limit as string))
      .get();

    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse(); // Reverse to get chronological order

    return res.json({
      success: true,
      messages
    });

  } catch (error: any) {
    functions.logger.error("Get draft messages error:", error);
    return res.status(500).json({ error: "Failed to get messages" });
  }
});

/**
 * Get user's draft rooms
 */
app.get("/draft-rooms", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, limit = 10 } = req.query;

    let query = RealtimeSystemService.db.collection("draft_rooms")
      .where("participants", "array-contains", req.user!.uid)
      .orderBy("updatedAt", "desc")
      .limit(parseInt(limit as string));

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    
    const draftRooms = snapshot.docs.map(doc => ({
      roomId: doc.id,
      ...doc.data()
    }));

    return res.json({
      success: true,
      draftRooms
    });

  } catch (error: any) {
    functions.logger.error("Get draft rooms error:", error);
    return res.status(500).json({ error: "Failed to get draft rooms" });
  }
});

/**
 * Leave draft room
 */
app.post("/draft-room/:roomId/leave", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId } = req.params;

    const roomRef = RealtimeSystemService.db.collection("draft_rooms").doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: "Draft room not found" });
    }

    const roomData = roomDoc.data();
    
    if (!roomData?.participants.includes(req.user!.uid)) {
      return res.status(400).json({ error: "Not in this room" });
    }

    if (roomData?.status === "active") {
      return res.status(400).json({ error: "Cannot leave active draft" });
    }

    // Remove user from participants
    const updatedParticipants = roomData?.participants.filter((p: string) => p !== req.user!.uid);
    
    await roomRef.update({
      participants: updatedParticipants,
      updatedAt: new Date()
    });

    // Trigger user left event
    await RealtimeSystemService.triggerEvent(
      `draft-room-${roomId}`,
      "user-left",
      {
        userId: req.user!.uid,
        participants: updatedParticipants
      }
    );

    return res.json({
      success: true,
      message: "Left draft room"
    });

  } catch (error: any) {
    functions.logger.error("Leave draft room error:", error);
    return res.status(500).json({ error: "Failed to leave draft room" });
  }
});

/**
 * Get Pusher authentication for private channels
 */
app.post("/pusher/auth", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { socket_id, channel_name } = req.body;

    if (!socket_id || !channel_name) {
      return res.status(400).json({ error: "Socket ID and channel name are required" });
    }

    // Verify user has access to the channel
    if (channel_name.startsWith("private-draft-room-")) {
      const roomId = channel_name.replace("private-draft-room-", "");
      
      const roomDoc = await RealtimeSystemService.db.collection("draft_rooms")
        .doc(roomId)
        .get();

      if (!roomDoc.exists) {
        return res.status(403).json({ error: "Room not found" });
      }

      const roomData = roomDoc.data();
      if (!roomData?.participants.includes(req.user!.uid)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Generate Pusher auth signature (simplified)
    const auth = `${socket_id}:${channel_name}`;
    
    return res.json({
      auth: auth,
      channel_data: JSON.stringify({
        user_id: req.user!.uid,
        user_info: {
          email: req.user!.email
        }
      })
    });

  } catch (error: any) {
    functions.logger.error("Pusher auth error:", error);
    return res.status(500).json({ error: "Failed to authenticate" });
  }
});

/**
 * Get real-time system health
 */
app.get("/health", async (req, res) => {
  try {
    const health = await RealtimeSystemService.getRealtimeSystemHealth();
    
    return res.json({
      success: true,
      health
    });

  } catch (error: any) {
    functions.logger.error("Real-time health check error:", error);
    return res.status(500).json({ error: "Health check failed" });
  }
});

export { app as realtimeRoutes };

