import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: functions.https.Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(config: RateLimitConfig) {
  return async (req: functions.https.Request, res: functions.Response, next?: () => void): Promise<void> => {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Generate key for rate limiting
    let key: string;
    if (config.keyGenerator) {
      key = config.keyGenerator(req);
    } else {
      // Use user ID if available, otherwise IP
      const userId = (req as any).user?.uid;
      key = userId || req.ip || "unknown";
    }
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }
    
    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      res.status(429).json({
        error: "Rate limit exceeded",
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
        retryAfter,
        limit: config.maxRequests,
        windowMs: config.windowMs
      });
      return;
    }
    
    // Increment counter
    entry.count++;
    rateLimitStore.set(key, entry);
    
    // Add rate limit headers
    res.set({
      "X-RateLimit-Limit": config.maxRequests.toString(),
      "X-RateLimit-Remaining": (config.maxRequests - entry.count).toString(),
      "X-RateLimit-Reset": entry.resetTime.toString()
    });
    
    if (next) {
      next();
    }
  };
}

// Predefined rate limiters
export const rateLimiters = {
  // General API - 100 requests per 15 minutes
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100
  }),
  
  // Authentication - 5 attempts per 5 minutes
  auth: createRateLimiter({
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
    keyGenerator: (req) => {
      // Rate limit by IP for auth to prevent brute force
      return req.ip || "unknown";
    }
  }),
  
  // AI operations - 10 requests per minute
  ai: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10
  }),
  
  // Data operations - 20 requests per minute
  data: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20
  }),
  
  // Real-time operations - 30 requests per minute
  realtime: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30
  }),
  
  // Strict rate limiting for expensive operations - 5 requests per minute
  strict: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5
  })
};

// Wrapper function to apply rate limiting to Firebase Functions
export function withRateLimit(
  rateLimiter: (req: functions.https.Request, res: functions.Response, next?: () => void) => Promise<void>,
  handler: (req: functions.https.Request, res: functions.Response) => Promise<void> | void
) {
  return async (req: functions.https.Request, res: functions.Response) => {
    try {
      await new Promise<void>((resolve, reject) => {
        rateLimiter(req, res, () => resolve()).catch(reject);
      });
      
      // If rate limit passed, execute the handler
      await handler(req, res);
    } catch (error: any) {
      console.error("Rate limiter error:", error);
      res.status(500).json({
        error: "Internal server error"
      });
    }
  };
}

