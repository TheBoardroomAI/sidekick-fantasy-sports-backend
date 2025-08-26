import * as admin from 'firebase-admin';

const db = admin.firestore();

interface VoiceSession {
  userId: string;
  sessionId: string;
  personaId: string;
  status: 'active' | 'processing' | 'completed' | 'error';
  startTime: Date;
  lastActivity: Date;
  audioBuffer?: ArrayBuffer;
  processingLock?: string;
}

export class VoiceSessionManager {
  private static readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private static readonly PROCESSING_TIMEOUT = 30 * 1000; // 30 seconds
  private static readonly MAX_CONCURRENT_SESSIONS = 3; // Per user

  // Start a new voice session with race condition protection
  static async startSession(
    userId: string, 
    personaId: string, 
    audioData?: ArrayBuffer
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      // Check for existing active sessions
      const activeSessions = await this.getActiveSessions(userId);
      
      if (activeSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
        // Clean up old sessions first
        await this.cleanupExpiredSessions(userId);
        
        // Check again after cleanup
        const activeAfterCleanup = await this.getActiveSessions(userId);
        if (activeAfterCleanup.length >= this.MAX_CONCURRENT_SESSIONS) {
          return {
            success: false,
            error: 'Maximum concurrent voice sessions reached. Please wait for current sessions to complete.'
          };
        }
      }

      // Generate unique session ID
      const sessionId = `voice_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create session with atomic write
      const sessionData: VoiceSession = {
        userId,
        sessionId,
        personaId,
        status: 'active',
        startTime: new Date(),
        lastActivity: new Date(),
        audioBuffer: audioData
      };

      // Use transaction to ensure atomicity
      await db.runTransaction(async (transaction) => {
        const sessionRef = db.collection('voice_sessions').doc(sessionId);
        
        // Check if session already exists (shouldn't happen with our ID generation)
        const existingSession = await transaction.get(sessionRef);
        if (existingSession.exists) {
          throw new Error('Session ID collision detected');
        }
        
        // Create the session
        transaction.set(sessionRef, sessionData);
        
        // Update user's active session count
        const userStatsRef = db.collection('user_stats').doc(userId);
        transaction.set(userStatsRef, {
          activeVoiceSessions: admin.firestore.FieldValue.increment(1),
          lastVoiceActivity: new Date()
        }, { merge: true });
      });

      console.log(`Voice session started: ${sessionId} for user ${userId}`);
      
      return {
        success: true,
        sessionId
      };

    } catch (error: any) {
      console.error('Error starting voice session:', error);
      return {
        success: false,
        error: error.message || 'Failed to start voice session'
      };
    }
  }

  // Acquire processing lock for a session
  static async acquireProcessingLock(
    sessionId: string, 
    processingId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await db.runTransaction(async (transaction) => {
        const sessionRef = db.collection('voice_sessions').doc(sessionId);
        const sessionDoc = await transaction.get(sessionRef);
        
        if (!sessionDoc.exists) {
          throw new Error('Session not found');
        }
        
        const sessionData = sessionDoc.data() as VoiceSession;
        
        // Check if session is already being processed
        if (sessionData.processingLock) {
          const lockAge = Date.now() - new Date(sessionData.lastActivity).getTime();
          
          // If lock is old, we can take over
          if (lockAge < this.PROCESSING_TIMEOUT) {
            throw new Error('Session is already being processed');
          }
        }
        
        // Check session timeout
        const sessionAge = Date.now() - new Date(sessionData.startTime).getTime();
        if (sessionAge > this.SESSION_TIMEOUT) {
          throw new Error('Session has expired');
        }
        
        // Acquire the lock
        transaction.update(sessionRef, {
          processingLock: processingId,
          status: 'processing',
          lastActivity: new Date()
        });
        
        return true;
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error acquiring processing lock:', error);
      return {
        success: false,
        error: error.message || 'Failed to acquire processing lock'
      };
    }
  }

  // Release processing lock
  static async releaseProcessingLock(
    sessionId: string, 
    processingId: string,
    status: 'completed' | 'error' = 'completed'
  ): Promise<void> {
    try {
      await db.runTransaction(async (transaction) => {
        const sessionRef = db.collection('voice_sessions').doc(sessionId);
        const sessionDoc = await transaction.get(sessionRef);
        
        if (!sessionDoc.exists) {
          return; // Session already cleaned up
        }
        
        const sessionData = sessionDoc.data() as VoiceSession;
        
        // Only release if we own the lock
        if (sessionData.processingLock === processingId) {
          transaction.update(sessionRef, {
            processingLock: admin.firestore.FieldValue.delete(),
            status,
            lastActivity: new Date()
          });
        }
      });

    } catch (error) {
      console.error('Error releasing processing lock:', error);
    }
  }

  // End a voice session
  static async endSession(sessionId: string, userId: string): Promise<void> {
    try {
      await db.runTransaction(async (transaction) => {
        const sessionRef = db.collection('voice_sessions').doc(sessionId);
        const sessionDoc = await transaction.get(sessionRef);
        
        if (!sessionDoc.exists) {
          return; // Already ended
        }
        
        const sessionData = sessionDoc.data() as VoiceSession;
        
        // Verify ownership
        if (sessionData.userId !== userId) {
          throw new Error('Unauthorized session access');
        }
        
        // Delete the session
        transaction.delete(sessionRef);
        
        // Update user stats
        const userStatsRef = db.collection('user_stats').doc(userId);
        transaction.set(userStatsRef, {
          activeVoiceSessions: admin.firestore.FieldValue.increment(-1),
          totalVoiceSessions: admin.firestore.FieldValue.increment(1)
        }, { merge: true });
      });

      console.log(`Voice session ended: ${sessionId}`);

    } catch (error) {
      console.error('Error ending voice session:', error);
    }
  }

  // Get active sessions for a user
  static async getActiveSessions(userId: string): Promise<VoiceSession[]> {
    try {
      const snapshot = await db.collection('voice_sessions')
        .where('userId', '==', userId)
        .where('status', 'in', ['active', 'processing'])
        .get();
      
      return snapshot.docs.map(doc => doc.data() as VoiceSession);

    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions(userId?: string): Promise<number> {
    try {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - this.SESSION_TIMEOUT);
      
      let query = db.collection('voice_sessions')
        .where('lastActivity', '<', expiredTime);
      
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      
      const expiredSessions = await query.limit(100).get();
      
      if (expiredSessions.empty) {
        return 0;
      }
      
      // Clean up in batches
      const batch = db.batch();
      const userUpdates = new Map<string, number>();
      
      expiredSessions.docs.forEach(doc => {
        const sessionData = doc.data() as VoiceSession;
        batch.delete(doc.ref);
        
        // Track user session count updates
        const currentCount = userUpdates.get(sessionData.userId) || 0;
        userUpdates.set(sessionData.userId, currentCount + 1);
      });
      
      // Update user stats
      userUpdates.forEach((count, userId) => {
        const userStatsRef = db.collection('user_stats').doc(userId);
        batch.set(userStatsRef, {
          activeVoiceSessions: admin.firestore.FieldValue.increment(-count)
        }, { merge: true });
      });
      
      await batch.commit();
      
      console.log(`Cleaned up ${expiredSessions.size} expired voice sessions`);
      return expiredSessions.size;

    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  // Get session status
  static async getSessionStatus(sessionId: string): Promise<VoiceSession | null> {
    try {
      const sessionDoc = await db.collection('voice_sessions').doc(sessionId).get();
      
      if (!sessionDoc.exists) {
        return null;
      }
      
      return sessionDoc.data() as VoiceSession;

    } catch (error) {
      console.error('Error getting session status:', error);
      return null;
    }
  }

  // Update session activity
  static async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await db.collection('voice_sessions').doc(sessionId).update({
        lastActivity: new Date()
      });

    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  // Check if user can start new session
  static async canStartNewSession(userId: string): Promise<{ canStart: boolean; reason?: string }> {
    try {
      const activeSessions = await this.getActiveSessions(userId);
      
      if (activeSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
        return {
          canStart: false,
          reason: `Maximum concurrent sessions (${this.MAX_CONCURRENT_SESSIONS}) reached`
        };
      }
      
      // Check for recent session activity (rate limiting)
      const recentSessions = activeSessions.filter(session => {
        const timeSinceStart = Date.now() - new Date(session.startTime).getTime();
        return timeSinceStart < 60000; // 1 minute
      });
      
      if (recentSessions.length >= 2) {
        return {
          canStart: false,
          reason: 'Too many sessions started recently. Please wait a moment.'
        };
      }
      
      return { canStart: true };

    } catch (error) {
      console.error('Error checking session eligibility:', error);
      return {
        canStart: false,
        reason: 'Unable to verify session eligibility'
      };
    }
  }
}

