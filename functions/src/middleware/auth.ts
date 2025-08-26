import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
}

/**
 * Middleware to verify Firebase ID token or API token
 */
export const authenticateUser = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No authorization token provided" });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      // Try to verify as Firebase ID token first
      const decodedToken = await AuthService.verifyIdToken(token);
      
      // Get user data from Firestore
      const user = await AuthService.getUserByUid(decodedToken.uid);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      req.user = {
        uid: user.uid,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus
      };

      next();
    } catch (firebaseError) {
      // If Firebase token verification fails, try API token
      try {
        const decoded = AuthService.verifyApiToken(token);
        req.user = decoded;
        next();
      } catch (apiError) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
    }
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
    return;
  }
};

/**
 * Middleware to check subscription tier access
 */
export const requireSubscriptionTier = (requiredTiers: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!requiredTiers.includes(req.user.subscriptionTier)) {
      res.status(403).json({ 
        error: "Insufficient subscription tier",
        required: requiredTiers,
        current: req.user.subscriptionTier
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if subscription is active
 */
export const requireActiveSubscription = (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.subscriptionStatus !== "active") {
    res.status(403).json({ 
      error: "Active subscription required",
      status: req.user.subscriptionStatus
    });
    return;
  }

  next();
};

