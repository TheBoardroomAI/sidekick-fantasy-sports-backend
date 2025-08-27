import * as functions from "firebase-functions/v1";
import express from "express";
import cors from "cors";
import { AuthService } from "../services/auth";
import { SubscriptionService } from "../services/subscription";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth";
import { db, COLLECTIONS } from "../config/firebase";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/**
 * Register a new user
 */
app.post("/register", async (req, res) => {
  try {
    const { email, displayName, subscriptionTier = "rookie", favoriteTeams } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Create user data
    const userData = await AuthService.createUser({
      email,
      displayName,
      subscriptionTier,
      favoriteTeams
    });

    // Create Firebase Auth user
    const userRecord = await AuthService.auth.createUser({
      email,
      displayName,
      emailVerified: false
    });

    // Save user to Firestore with Firebase UID
    userData.uid = userRecord.uid;
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData);

    // Generate API token
    const apiToken = AuthService.generateApiToken(userData);

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        subscriptionTier: userData.subscriptionTier
      },
      apiToken
    });

  } catch (error: any) {
    functions.logger.error("Registration error:", error);
    return res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * Login user (verify Firebase ID token)
 */
app.post("/login", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify Firebase ID token
    const decodedToken = await AuthService.verifyIdToken(idToken);
    
    // Get user data
    const user = await AuthService.getUserByUid(decodedToken.uid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update last login
    await AuthService.updateLastLogin(user.uid);

    // Generate API token
    const apiToken = AuthService.generateApiToken(user);

    return res.json({
      message: "Login successful",
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus
      },
      apiToken
    });

  } catch (error: any) {
    functions.logger.error("Login error:", error);
    return res.status(401).json({ error: "Invalid credentials" });
  }
});

/**
 * Get current user profile
 */
app.get("/profile", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await AuthService.getUserByUid(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        preferences: user.preferences,
        usage: user.usage,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error: any) {
    functions.logger.error("Profile error:", error);
    return res.status(500).json({ error: "Failed to get profile" });
  }
});

/**
 * Update user profile
 */
app.put("/profile", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { displayName, photoURL, preferences } = req.body;

    const updatedUser = await AuthService.updateUser(req.user!.uid, {
      displayName,
      photoURL,
      preferences
    });

    return res.json({
      message: "Profile updated successfully",
      user: {
        uid: updatedUser.uid,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        photoURL: updatedUser.photoURL,
        preferences: updatedUser.preferences
      }
    });

  } catch (error: any) {
    functions.logger.error("Profile update error:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * Create Stripe checkout session
 */
app.post("/subscribe", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { tier, interval = "monthly" } = req.body;

    if (!tier || !["rookie", "pro", "champion"].includes(tier)) {
      return res.status(400).json({ error: "Valid subscription tier is required" });
    }

    const checkoutUrl = await SubscriptionService.createCheckoutSession(
      req.user!.uid,
      tier,
      interval
    );

    return res.json({
      checkoutUrl
    });

  } catch (error: any) {
    functions.logger.error("Subscription error:", error);
    return res.status(500).json({ error: "Failed to create subscription" });
  }
});

/**
 * Get subscription status
 */
app.get("/subscription", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const status = await SubscriptionService.getSubscriptionStatus(req.user!.uid);
    return res.json(status);

  } catch (error: any) {
    functions.logger.error("Subscription status error:", error);
    return res.status(500).json({ error: "Failed to get subscription status" });
  }
});

/**
 * Stripe webhook handler
 */
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {

    // Verify webhook signature (simplified for now)
    const event = req.body;

    switch (event.type) {
    case "customer.subscription.created":
      await SubscriptionService.handleSubscriptionCreated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await SubscriptionService.handleSubscriptionCanceled(event.data.object);
      break;
    default:
      functions.logger.info(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });

  } catch (error: any) {
    functions.logger.error("Webhook error:", error);
    return res.status(400).json({ error: "Webhook error" });
  }
});

export { app as authRoutes };

