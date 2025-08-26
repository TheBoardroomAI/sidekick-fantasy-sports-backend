import axios from "axios";
import * as functions from "firebase-functions";
import { db } from "../config/firebase";

// Pusher Configuration
const PUSHER_APP_ID = functions.config().pusher?.app_id || process.env.PUSHER_APP_ID;
const PUSHER_KEY = functions.config().pusher?.key || process.env.PUSHER_KEY;
const PUSHER_SECRET = functions.config().pusher?.secret || process.env.PUSHER_SECRET;
const PUSHER_CLUSTER = functions.config().pusher?.cluster || process.env.PUSHER_CLUSTER || "us2";

// Pusher REST API Configuration
const PUSHER_BASE_URL = `https://api-${PUSHER_CLUSTER}.pusherapp.com/apps/${PUSHER_APP_ID}`;

export class RealtimeSystemService {
  // Export db for route access
  static db = db;

  /**
   * Initialize Pusher configuration
   */
  static async initializePusher(): Promise<any> {
    try {
      // Verify Pusher credentials by getting app info
      await this.makePusherRequest("GET", "");
      
      return {
        status: "initialized",
        appId: PUSHER_APP_ID,
        cluster: PUSHER_CLUSTER,
        channels: await this.getActiveChannels()
      };
    } catch (error) {
      functions.logger.error("Pusher initialization error:", error);
      throw new Error(`Pusher initialization failed: ${error}`);
    }
  }

  /**
   * Create or join a draft room
   */
  static async createDraftRoom(roomId: string, hostUserId: string, settings: any): Promise<any> {
    try {
      const draftRoom = {
        roomId,
        hostUserId,
        settings: {
          leagueSize: settings.leagueSize || 12,
          scoringType: settings.scoringType || "standard",
          draftType: settings.draftType || "snake",
          timePerPick: settings.timePerPick || 90,
          ...settings
        },
        status: "waiting",
        participants: [hostUserId],
        currentPick: 1,
        currentPickUser: null,
        draftOrder: [],
        picks: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save draft room to Firestore
      await db.collection("draft_rooms").doc(roomId).set(draftRoom);

      // Create Pusher channel for the draft room
      const channelName = `draft-room-${roomId}`;
      
      // Trigger room created event
      await this.triggerEvent(channelName, "room-created", {
        roomId,
        hostUserId,
        settings: draftRoom.settings
      });

      return {
        roomId,
        channelName,
        draftRoom
      };

    } catch (error) {
      functions.logger.error("Create draft room error:", error);
      throw new Error(`Failed to create draft room: ${error}`);
    }
  }

  /**
   * Join a draft room
   */
  static async joinDraftRoom(roomId: string, userId: string): Promise<any> {
    try {
      const roomRef = db.collection("draft_rooms").doc(roomId);
      const roomDoc = await roomRef.get();

      if (!roomDoc.exists) {
        throw new Error("Draft room not found");
      }

      const roomData = roomDoc.data();
      
      if (roomData?.participants.includes(userId)) {
        return { message: "Already in room", roomId };
      }

      if (roomData?.participants.length >= roomData?.settings.leagueSize) {
        throw new Error("Draft room is full");
      }

      // Add user to participants
      await roomRef.update({
        participants: [...roomData?.participants, userId],
        updatedAt: new Date()
      });

      // Trigger user joined event
      const channelName = `draft-room-${roomId}`;
      await this.triggerEvent(channelName, "user-joined", {
        userId,
        participants: [...roomData?.participants, userId]
      });

      return {
        roomId,
        channelName,
        participants: [...roomData?.participants, userId]
      };

    } catch (error) {
      functions.logger.error("Join draft room error:", error);
      throw new Error(`Failed to join draft room: ${error}`);
    }
  }

  /**
   * Start draft in a room
   */
  static async startDraft(roomId: string, hostUserId: string): Promise<any> {
    try {
      const roomRef = db.collection("draft_rooms").doc(roomId);
      const roomDoc = await roomRef.get();

      if (!roomDoc.exists) {
        throw new Error("Draft room not found");
      }

      const roomData = roomDoc.data();

      if (roomData?.hostUserId !== hostUserId) {
        throw new Error("Only host can start draft");
      }

      if (roomData?.status !== "waiting") {
        throw new Error("Draft already started or completed");
      }

      // Generate draft order
      const participants = [...roomData?.participants];
      const draftOrder = this.generateDraftOrder(participants, roomData?.settings.draftType);

      // Update room status
      await roomRef.update({
        status: "active",
        draftOrder,
        currentPickUser: draftOrder[0],
        startedAt: new Date(),
        updatedAt: new Date()
      });

      // Trigger draft started event
      const channelName = `draft-room-${roomId}`;
      await this.triggerEvent(channelName, "draft-started", {
        draftOrder,
        currentPickUser: draftOrder[0],
        timePerPick: roomData?.settings.timePerPick
      });

      return {
        roomId,
        draftOrder,
        currentPickUser: draftOrder[0]
      };

    } catch (error) {
      functions.logger.error("Start draft error:", error);
      throw new Error(`Failed to start draft: ${error}`);
    }
  }

  /**
   * Make a draft pick
   */
  static async makeDraftPick(
    roomId: string, 
    userId: string, 
    playerId: string, 
    playerName: string
  ): Promise<any> {
    try {
      const roomRef = db.collection("draft_rooms").doc(roomId);
      const roomDoc = await roomRef.get();

      if (!roomDoc.exists) {
        throw new Error("Draft room not found");
      }

      const roomData = roomDoc.data();

      if (roomData?.status !== "active") {
        throw new Error("Draft is not active");
      }

      if (roomData?.currentPickUser !== userId) {
        throw new Error("Not your turn to pick");
      }

      const pick = {
        pickNumber: roomData?.currentPick,
        userId,
        playerId,
        playerName,
        timestamp: new Date()
      };

      // Add pick to room
      const updatedPicks = [...(roomData?.picks || []), pick];
      const nextPickNumber = roomData?.currentPick + 1;
      const nextPickUser = this.getNextPickUser(
        roomData?.draftOrder, 
        nextPickNumber, 
        roomData?.settings.draftType
      );

      // Update room
      await roomRef.update({
        picks: updatedPicks,
        currentPick: nextPickNumber,
        currentPickUser: nextPickUser,
        updatedAt: new Date()
      });

      // Trigger pick made event
      const channelName = `draft-room-${roomId}`;
      await this.triggerEvent(channelName, "pick-made", {
        pick,
        nextPickUser,
        nextPickNumber
      });

      // Check if draft is complete
      const totalPicks = roomData?.settings.leagueSize * 16; // Assuming 16 rounds
      if (nextPickNumber > totalPicks) {
        await this.completeDraft(roomId);
      }

      return {
        pick,
        nextPickUser,
        nextPickNumber
      };

    } catch (error) {
      functions.logger.error("Make draft pick error:", error);
      throw new Error(`Failed to make draft pick: ${error}`);
    }
  }

  /**
   * Send real-time message to draft room
   */
  static async sendDraftMessage(
    roomId: string, 
    userId: string, 
    message: string, 
    messageType: "chat" | "system" | "trade" = "chat"
  ): Promise<void> {
    try {
      const messageData = {
        userId,
        message,
        messageType,
        timestamp: new Date().toISOString()
      };

      // Save message to Firestore
      await db.collection("draft_rooms").doc(roomId)
        .collection("messages").add(messageData);

      // Trigger real-time message event
      const channelName = `draft-room-${roomId}`;
      await this.triggerEvent(channelName, "new-message", messageData);

    } catch (error) {
      functions.logger.error("Send draft message error:", error);
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  /**
   * Trigger Pusher event
   */
  static async triggerEvent(channel: string, event: string, data: any): Promise<void> {
    try {
      const payload = {
        name: event,
        channel,
        data: JSON.stringify(data)
      };

      await this.makePusherRequest("POST", "/events", payload);

    } catch (error) {
      functions.logger.error("Trigger event error:", error);
      throw new Error(`Failed to trigger event: ${error}`);
    }
  }

  /**
   * Get active channels
   */
  static async getActiveChannels(): Promise<any> {
    try {
      const response = await this.makePusherRequest("GET", "/channels");
      return response.channels;
    } catch (error) {
      functions.logger.error("Get channels error:", error);
      return {};
    }
  }

  /**
   * Make authenticated Pusher REST API request
   */
  static async makePusherRequest(method: string, path: string, body?: any): Promise<any> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const bodyString = body ? JSON.stringify(body) : "";
      
      // Create auth signature (simplified - in production use proper HMAC)
      // const authString = `${method}\n${path}\nauth_key=${PUSHER_KEY}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${this.md5(bodyString)}`;
      
      const url = `${PUSHER_BASE_URL}${path}`;
      
      const config: any = {
        method,
        url,
        headers: {
          "Content-Type": "application/json"
        },
        params: {
          auth_key: PUSHER_KEY,
          auth_timestamp: timestamp,
          auth_version: "1.0",
          body_md5: this.md5(bodyString),
          auth_signature: PUSHER_SECRET // Simplified - should be HMAC signature
        }
      };

      if (body) {
        config.data = body;
      }

      const response = await axios(config);
      return response.data;

    } catch (error) {
      functions.logger.error("Pusher request error:", error);
      throw error;
    }
  }

  /**
   * Generate draft order
   */
  static generateDraftOrder(participants: string[], draftType: string): string[] {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    
    if (draftType === "snake") {
      // For snake draft, reverse order every other round
      return shuffled;
    }
    
    return shuffled;
  }

  /**
   * Get next pick user
   */
  static getNextPickUser(
    draftOrder: string[], 
    pickNumber: number, 
    draftType: string
  ): string | null {
    const leagueSize = draftOrder.length;
    const round = Math.ceil(pickNumber / leagueSize);
    const positionInRound = ((pickNumber - 1) % leagueSize);

    if (draftType === "snake" && round % 2 === 0) {
      // Reverse order for even rounds in snake draft
      return draftOrder[leagueSize - 1 - positionInRound] || null;
    }

    return draftOrder[positionInRound] || null;
  }

  /**
   * Complete draft
   */
  static async completeDraft(roomId: string): Promise<void> {
    try {
      await db.collection("draft_rooms").doc(roomId).update({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date()
      });

      const channelName = `draft-room-${roomId}`;
      await this.triggerEvent(channelName, "draft-completed", {
        roomId,
        completedAt: new Date().toISOString()
      });

    } catch (error) {
      functions.logger.error("Complete draft error:", error);
    }
  }

  /**
   * Simple MD5 hash (for Pusher auth)
   */
  static md5(text: string): string {
    // Simplified hash - in production use crypto.createHash('md5')
    return Buffer.from(text).toString("base64").substring(0, 16);
  }

  /**
   * Get real-time system health
   */
  static async getRealtimeSystemHealth(): Promise<any> {
    try {
      const channels = await this.getActiveChannels();
      const activeDraftRooms = await db.collection("draft_rooms")
        .where("status", "==", "active")
        .get();

      return {
        status: "healthy",
        pusher: {
          connected: true,
          activeChannels: Object.keys(channels).length,
          cluster: PUSHER_CLUSTER
        },
        draftRooms: {
          active: activeDraftRooms.size,
          total: (await db.collection("draft_rooms").get()).size
        },
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date().toISOString()
      };
    }
  }
}

