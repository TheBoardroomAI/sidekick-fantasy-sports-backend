import * as functions from "firebase-functions/v1";
import { SubscriptionService } from "../services/subscription";

// Stripe webhook handler with proper signature validation
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Stripe-Signature");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Get the signature from headers
    const signature = req.headers["stripe-signature"];
    
    if (!signature) {
      console.error("Missing Stripe signature header");
      return res.status(400).json({ error: "Missing signature header" });
      return;
    }

    // Get raw body for signature verification
    const payload = req.rawBody?.toString() || JSON.stringify(req.body);
    
    if (!payload) {
      console.error("Missing request payload");
      return res.status(400).json({ error: "Missing payload" });
      return;
    }

    // Validate webhook signature and construct event
    let event;
    try {
      event = SubscriptionService.validateWebhookSignature(payload, signature as string);
    } catch (error: any) {
      console.error("Webhook signature verification failed:", error?.message || "Unknown error");
      return res.status(400).json({ 
        error: "Webhook signature verification failed",
        details: error?.message || "Unknown error" 
      });
      return;
    }

    // Log the event for debugging
    console.log(`Received Stripe webhook: ${event.type} (${event.id})`);

    // Process the verified event
    try {
      await SubscriptionService.processWebhookEvent(event);
      
      // Respond to Stripe that we received the event successfully
      return res.json({ 
        received: true,
        eventId: event.id,
        eventType: event.type
      });
      
    } catch (processingError: any) {
      console.error(`Error processing webhook event ${event.type}:`, processingError);
      
      // Return 500 so Stripe will retry the webhook
      return res.status(500).json({
        error: "Event processing failed",
        eventId: event.id,
        eventType: event.type,
        details: processingError.message
      });
    }

  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message || "Unknown error"
    });
  }
});

// Subscription management endpoints
export const createCheckoutSession = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Verify token (you'll need to implement this)
    // const decodedToken = await admin.auth().verifyIdToken(token);
    // const userId = decodedToken.uid;
    
    // For now, get userId from request body (implement proper auth)
    const { userId, tier } = req.body;
    
    if (!userId || !tier) {
      return res.status(400).json({ error: "Missing userId or tier" });
      return;
    }

    // Validate tier
    const validTiers = ["rookie", "pro", "champion"];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid subscription tier" });
      return;
    }

    // Create checkout session
    const checkoutUrl = await SubscriptionService.createCheckoutSession(userId, tier);
    
    return res.json({
      success: true,
      checkoutUrl
    });

  } catch (error: any) {
    console.error("Create checkout session error:", error);
    return res.status(500).json({
      error: "Failed to create checkout session",
      details: error?.message || "Unknown error"
    });
  }
});

// Get subscription status
export const getSubscriptionStatus = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Verify token and get userId (implement proper auth)
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
      return;
    }

    // Get subscription status
    const status = await SubscriptionService.getSubscriptionStatus(userId);
    
    return res.json({
      success: true,
      subscription: status
    });

  } catch (error: any) {
    console.error("Get subscription status error:", error);
    return res.status(500).json({
      error: "Failed to get subscription status",
      details: error?.message || "Unknown error"
    });
  }
});

// Export webhook routes
export const webhookRoutes = functions.https.onRequest(async (req, res) => {
  const path = req.path;
  
  if (path === "/stripe") {
    return stripeWebhook(req, res);
  } else if (path === "/checkout") {
    return createCheckoutSession(req, res);
  } else if (path === "/status") {
    return getSubscriptionStatus(req, res);
  } else {
    return res.status(404).json({ error: "Webhook endpoint not found" });
  }
});

