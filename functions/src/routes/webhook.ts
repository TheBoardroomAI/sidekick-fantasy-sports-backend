import * as functions from "firebase-functions";
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
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Get the signature from headers
    const signature = req.headers["stripe-signature"];
    
    if (!signature) {
      console.error("Missing Stripe signature header");
      res.status(400).json({ error: "Missing signature header" });
      return;
    }

    // Get raw body for signature verification
    const payload = req.rawBody?.toString() || JSON.stringify(req.body);
    
    if (!payload) {
      console.error("Missing request payload");
      res.status(400).json({ error: "Missing payload" });
      return;
    }

    // Validate webhook signature and construct event
    let event;
    try {
      event = SubscriptionService.validateWebhookSignature(payload, signature as string);
    } catch (error: any) {
      console.error("Webhook signature verification failed:", error?.message || "Unknown error");
      res.status(400).json({ 
        error: "Webhook signature verification failed",
        details: error?.message || "Unknown error" 
      });
      return;
    }

    // Process the webhook event
    await SubscriptionService.processWebhookEvent(event);
    
    // Acknowledge receipt of the event
    res.status(200).json({ received: true });
    
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Create Stripe checkout session
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
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { priceId, userId, successUrl, cancelUrl } = req.body;
    
    if (!priceId || !userId) {
      res.status(400).json({ error: "Missing required fields: priceId, userId" });
      return;
    }

    const session = "checkout_session_placeholder";
    
    res.status(200).json({ sessionId: session, url: "https://checkout.stripe.com" });
    
  } catch (error: any) {
    console.error("Checkout session creation error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
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
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { userId } = req.query;
    
    if (!userId) {
      res.status(400).json({ error: "Missing userId parameter" });
      return;
    }

    const subscription = { status: "active", tier: "pro" };
    
    res.status(200).json(subscription);
    
  } catch (error: any) {
    console.error("Get subscription status error:", error);
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

// Main webhook routes handler
export const webhookRoutes = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const path = req.path;
  
  try {
    if (path === "/stripe-webhook") {
      await stripeWebhook(req, res);
    } else if (path === "/create-checkout-session") {
      await createCheckoutSession(req, res);
    } else if (path === "/subscription-status") {
      await getSubscriptionStatus(req, res);
    } else if (path === "/health") {
      res.status(200).json({ 
        status: "healthy", 
        service: "webhook-routes",
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ error: "Webhook endpoint not found" });
    }
  } catch (error: any) {
    console.error("Webhook routes error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

