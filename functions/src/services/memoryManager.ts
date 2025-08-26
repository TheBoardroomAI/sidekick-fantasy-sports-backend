import * as admin from 'firebase-admin';

const db = admin.firestore();

interface MemoryUsage {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface VoiceProcessingSession {
  sessionId: string;
  audioBuffer?: ArrayBuffer;
  processedData?: any;
  startTime: Date;
  lastActivity: Date;
  cleanup?: () => void;
}

export class MemoryManager {
  private static voiceSessions = new Map<string, VoiceProcessingSession>();
  private static memoryMonitorInterval: NodeJS.Timeout | null = null;
  private static readonly MEMORY_THRESHOLD = 512 * 1024 * 1024; // 512MB
  private static readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private static readonly MONITOR_INTERVAL = 30 * 1000; // 30 seconds

  // Initialize memory monitoring
  static initialize(): void {
    console.log('Initializing memory manager...');
    
    // Start memory monitoring
    this.startMemoryMonitoring();
    
    // Set up cleanup intervals
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000); // Every minute

    // Set up garbage collection hints
    setInterval(() => {
      this.suggestGarbageCollection();
    }, 2 * 60 * 1000); // Every 2 minutes

    console.log('Memory manager initialized');
  }

  // Start memory monitoring
  private static startMemoryMonitoring(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }

    this.memoryMonitorInterval = setInterval(() => {
      this.monitorMemoryUsage();
    }, this.MONITOR_INTERVAL);
  }

  // Monitor memory usage
  private static async monitorMemoryUsage(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      
      const usage: MemoryUsage = {
        timestamp: new Date(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers || 0
      };

      // Log memory usage
      console.log(`Memory Usage - Heap: ${Math.round(usage.heapUsed / 1024 / 1024)}MB / ${Math.round(usage.heapTotal / 1024 / 1024)}MB, RSS: ${Math.round(usage.rss / 1024 / 1024)}MB`);

      // Check for memory pressure
      if (usage.heapUsed > this.MEMORY_THRESHOLD) {
        console.warn(`High memory usage detected: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
        await this.handleMemoryPressure();
      }

      // Store memory metrics (sample every 5 minutes)
      if (Date.now() % (5 * 60 * 1000) < this.MONITOR_INTERVAL) {
        await this.storeMemoryMetrics(usage);
      }

    } catch (error) {
      console.error('Memory monitoring error:', error);
    }
  }

  // Handle memory pressure
  private static async handleMemoryPressure(): Promise<void> {
    console.log('Handling memory pressure...');

    // 1. Clean up expired voice sessions
    const cleanedSessions = this.cleanupExpiredSessions();
    console.log(`Cleaned up ${cleanedSessions} expired voice sessions`);

    // 2. Clear old cache entries
    try {
      const { CacheManager } = await import('./cacheManager');
      await CacheManager.cleanup();
    } catch (error) {
      console.error('Error cleaning cache during memory pressure:', error);
    }

    // 3. Force garbage collection if available
    this.forceGarbageCollection();

    // 4. Log memory usage after cleanup
    const memUsage = process.memoryUsage();
    console.log(`Memory after cleanup - Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  }

  // Create voice processing session
  static createVoiceSession(sessionId: string, audioBuffer?: ArrayBuffer): VoiceProcessingSession {
    const session: VoiceProcessingSession = {
      sessionId,
      audioBuffer,
      startTime: new Date(),
      lastActivity: new Date(),
      cleanup: () => {
        // Cleanup function to release resources
        if (session.audioBuffer) {
          session.audioBuffer = undefined;
        }
        if (session.processedData) {
          session.processedData = undefined;
        }
      }
    };

    this.voiceSessions.set(sessionId, session);
    
    console.log(`Created voice session: ${sessionId}, Total sessions: ${this.voiceSessions.size}`);
    
    return session;
  }

  // Update voice session activity
  static updateVoiceSessionActivity(sessionId: string): void {
    const session = this.voiceSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  // Set processed data for voice session
  static setVoiceSessionData(sessionId: string, data: any): void {
    const session = this.voiceSessions.get(sessionId);
    if (session) {
      session.processedData = data;
      session.lastActivity = new Date();
    }
  }

  // Clean up voice session
  static cleanupVoiceSession(sessionId: string): boolean {
    const session = this.voiceSessions.get(sessionId);
    
    if (session) {
      // Call cleanup function if available
      if (session.cleanup) {
        session.cleanup();
      }
      
      // Remove from map
      this.voiceSessions.delete(sessionId);
      
      console.log(`Cleaned up voice session: ${sessionId}, Remaining sessions: ${this.voiceSessions.size}`);
      return true;
    }
    
    return false;
  }

  // Clean up expired voice sessions
  static cleanupExpiredSessions(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.voiceSessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceActivity > this.SESSION_TIMEOUT) {
        this.cleanupVoiceSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired voice sessions`);
    }

    return cleanedCount;
  }

  // Get voice session
  static getVoiceSession(sessionId: string): VoiceProcessingSession | undefined {
    return this.voiceSessions.get(sessionId);
  }

  // Get all active voice sessions
  static getActiveVoiceSessions(): VoiceProcessingSession[] {
    return Array.from(this.voiceSessions.values());
  }

  // Suggest garbage collection
  private static suggestGarbageCollection(): void {
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Suggest GC if heap usage is above 70%
    if (heapUsagePercent > 70) {
      console.log(`High heap usage (${Math.round(heapUsagePercent)}%), suggesting garbage collection`);
      this.forceGarbageCollection();
    }
  }

  // Force garbage collection if available
  private static forceGarbageCollection(): void {
    if (global.gc) {
      console.log('Forcing garbage collection...');
      global.gc();
      
      const memUsage = process.memoryUsage();
      console.log(`Memory after GC - Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    } else {
      console.log('Garbage collection not available (run with --expose-gc flag)');
    }
  }

  // Store memory metrics
  private static async storeMemoryMetrics(usage: MemoryUsage): Promise<void> {
    try {
      await db.collection('memory_metrics').add({
        ...usage,
        activeSessions: this.voiceSessions.size,
        sessionDetails: Array.from(this.voiceSessions.values()).map(session => ({
          sessionId: session.sessionId,
          age: Date.now() - session.startTime.getTime(),
          hasAudioBuffer: !!session.audioBuffer,
          hasProcessedData: !!session.processedData
        }))
      });
    } catch (error) {
      console.error('Error storing memory metrics:', error);
    }
  }

  // Get memory statistics
  static getMemoryStats(): any {
    const memUsage = process.memoryUsage();
    
    return {
      current: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024)
      },
      sessions: {
        active: this.voiceSessions.size,
        details: Array.from(this.voiceSessions.values()).map(session => ({
          sessionId: session.sessionId,
          ageMinutes: Math.round((Date.now() - session.startTime.getTime()) / 60000),
          hasAudioBuffer: !!session.audioBuffer,
          hasProcessedData: !!session.processedData
        }))
      },
      thresholds: {
        memoryThresholdMB: Math.round(this.MEMORY_THRESHOLD / 1024 / 1024),
        sessionTimeoutMinutes: Math.round(this.SESSION_TIMEOUT / 60000)
      }
    };
  }

  // Clean up all resources
  static cleanup(): void {
    console.log('Cleaning up memory manager...');

    // Stop monitoring
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }

    // Clean up all voice sessions
    for (const sessionId of this.voiceSessions.keys()) {
      this.cleanupVoiceSession(sessionId);
    }

    console.log('Memory manager cleanup completed');
  }

  // Create safe buffer from audio data
  static createSafeAudioBuffer(audioData: string | ArrayBuffer): ArrayBuffer | null {
    try {
      if (typeof audioData === 'string') {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes.buffer;
      } else if (audioData instanceof ArrayBuffer) {
        return audioData;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating audio buffer:', error);
      return null;
    }
  }

  // Release audio buffer safely
  static releaseAudioBuffer(buffer: ArrayBuffer | undefined): void {
    if (buffer) {
      // In Node.js, ArrayBuffers are garbage collected automatically
      // Just remove the reference
      buffer = undefined;
    }
  }

  // Monitor specific function for memory leaks
  static monitorFunction<T>(
    functionName: string,
    fn: () => Promise<T>
  ): () => Promise<T> {
    return async (): Promise<T> => {
      const startMemory = process.memoryUsage();
      const startTime = Date.now();
      
      try {
        const result = await fn();
        
        const endMemory = process.memoryUsage();
        const endTime = Date.now();
        
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
        const duration = endTime - startTime;
        
        // Log if significant memory increase
        if (memoryDelta > 10 * 1024 * 1024) { // 10MB
          console.warn(`Function ${functionName} increased memory by ${Math.round(memoryDelta / 1024 / 1024)}MB in ${duration}ms`);
        }
        
        return result;
      } catch (error) {
        console.error(`Function ${functionName} failed:`, error);
        throw error;
      }
    };
  }
}

