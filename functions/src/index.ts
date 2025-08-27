import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";

// Define secrets
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Import route handlers
import { authRoutes } from "./routes/auth";
import { dataRoutes } from "./routes/data";
import { personaRoutes } from "./routes/persona";
import { zaneRoutes } from "./routes/zane";
import { realtimeRoutes } from "./routes/realtime";
import { webhookRoutes } from "./routes/webhook";

// Optimized function configuration for cold start mitigation
const optimizedConfig = {
  memory: "1GB" as const,
  timeoutSeconds: 60,
  minInstances: 2, // Keep 2 instances warm to prevent cold starts
  maxInstances: 100,
  concurrency: 80, // Handle multiple requests per instance
};

// Critical functions with warm instances
const criticalConfig = {
  memory: "512MB" as const,
  timeoutSeconds: 30,
  minInstances: 1, // Keep at least 1 warm
  maxInstances: 50,
  concurrency: 40,
};

// Health check endpoint (lightweight, no warm instances needed)
export const healthCheck = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 10,
    minInstances: 0,
    maxInstances: 10
  })
  .https.onRequest((request, response) => {
    functions.logger.info("Health check requested", {structuredData: true});
    
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }
    
    response.json({
      status: "healthy",
      service: "SideKick Fantasy Sports Backend",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: "firebase-functions",
      features: {
        authentication: "active",
        dataIntegration: "active", 
        voiceSystem: "active",
        realtimeLayer: "active",
        personaEngine: "active",
        zaneReporter: "active"
      }
    });
  });

// Authentication routes (critical - keep warm) - requires Stripe secret for subscriptions
export const auth = functions
  .runWith({
    ...criticalConfig,
    secrets: [stripeSecretKey] // Add secret access for subscription operations
  })
  .https.onRequest(authRoutes);

// Data routes (high usage - keep warm)
export const data = functions
  .runWith(optimizedConfig)
  .https.onRequest(dataRoutes);

// Persona routes (AI-heavy - optimized for performance) - requires OpenAI secret
export const persona = functions
  .runWith({
    memory: "1GB" as const, // Reduced from 2GB to avoid limits
    timeoutSeconds: 120, // AI operations may take longer
    minInstances: 1,
    maxInstances: 10, // Reduced from 20 to avoid limits
    secrets: [openaiApiKey] // Add secret access
  })
  .https.onRequest(personaRoutes);

// Zane AI reporter (AI-heavy - similar to persona)
export const zane = functions
  .runWith({
    memory: "1GB" as const,
    timeoutSeconds: 90,
    minInstances: 1,
    maxInstances: 15
  })
  .https.onRequest(zaneRoutes);

// Real-time routes (moderate usage)
export const realtime = functions
  .runWith(criticalConfig)
  .https.onRequest(realtimeRoutes);

// Webhook routes (critical for payments - keep warm) - requires Stripe secret
export const webhook = functions
  .runWith({
    memory: "512MB" as const,
    timeoutSeconds: 30,
    minInstances: 1, // Always keep warm for Stripe webhooks
    maxInstances: 10,
    secrets: [stripeSecretKey] // Add secret access
  })
  .https.onRequest(webhookRoutes);

// Function warming scheduler to prevent cold starts
export const keepWarm = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 60
  })
  .pubsub.schedule("every 5 minutes")
  .onRun(async (context) => {
    const baseUrl = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net`;
    
    const warmupRequests = [
      fetch(`${baseUrl}/healthCheck`),
      fetch(`${baseUrl}/auth/health`),
      fetch(`${baseUrl}/data/health`),
      fetch(`${baseUrl}/persona/health`),
      fetch(`${baseUrl}/realtime/health`)
    ];

    try {
      await Promise.allSettled(warmupRequests);
      console.log("Function warmup completed successfully");
    } catch (error: any) {
      console.error("Function warmup failed:", error);
    }

    return null;
  });

// Database cleanup scheduler
export const cleanupExpiredSessions = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 300
  })
  .pubsub.schedule("every 24 hours")
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      // Clean up expired rate limit entries
      const expiredSessions = await db.collection("rate_limits")
        .where("expiresAt", "<", oneDayAgo)
        .limit(500)
        .get();

      const batch = db.batch();
      expiredSessions.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      if (!expiredSessions.empty) {
        await batch.commit();
        console.log(`Cleaned up ${expiredSessions.size} expired rate limit entries`);
      }

      // Clean up old error logs (keep only last 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oldErrorLogs = await db.collection("error_logs")
        .where("timestamp", "<", sevenDaysAgo)
        .limit(1000)
        .get();

      if (!oldErrorLogs.empty) {
        const errorBatch = db.batch();
        oldErrorLogs.docs.forEach(doc => {
          errorBatch.delete(doc.ref);
        });
        await errorBatch.commit();
        console.log(`Cleaned up ${oldErrorLogs.size} old error logs`);
      }

    } catch (error: any) {
      console.error("Cleanup failed:", error);
    }

    return null;
  });

// Performance monitoring
export const performanceMonitor = functions
  .runWith({
    memory: "256MB",
    timeoutSeconds: 60
  })
  .pubsub.schedule("every 15 minutes")
  .onRun(async (context) => {
    const db = admin.firestore();
    
    try {
      // Log performance metrics
      const metrics = {
        timestamp: new Date(),
        activeUsers: await getActiveUserCount(),
        functionInvocations: await getFunctionInvocationCount(),
        errorRate: await getErrorRate(),
        avgResponseTime: await getAverageResponseTime()
      };

      await db.collection("performance_metrics").add(metrics);
      console.log("Performance metrics logged:", metrics);

    } catch (error: any) {
      console.error("Performance monitoring failed:", error);
    }

    return null;
  });

// Helper functions for performance monitoring
async function getActiveUserCount(): Promise<number> {
  const db = admin.firestore();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  const activeUsers = await db.collection("user_activity")
    .where("lastSeen", ">", fifteenMinutesAgo)
    .get();
    
  return activeUsers.size;
}

async function getFunctionInvocationCount(): Promise<number> {
  // This would integrate with Cloud Monitoring API
  // For now, return a placeholder
  return 0;
}

async function getErrorRate(): Promise<number> {
  const db = admin.firestore();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const errors = await db.collection("error_logs")
    .where("timestamp", ">", oneHourAgo)
    .get();
    
  return errors.size;
}

async function getAverageResponseTime(): Promise<number> {
  // This would integrate with Cloud Monitoring API
  // For now, return a placeholder
  return 0;
}

