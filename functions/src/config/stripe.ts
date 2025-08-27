import Stripe from "stripe";
import * as functions from "firebase-functions/v1";

// Initialize Stripe with secret key from Firebase Secret Manager
const stripeSecretKey = functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Stripe secret key not found in Firebase config or environment variables");
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-07-30.basil",
});

// Subscription tier pricing
export const STRIPE_PRICES = {
  ROOKIE: {
    monthly: "price_rookie_monthly", // Replace with actual Stripe price IDs
    yearly: "price_rookie_yearly"
  },
  PRO: {
    monthly: "price_pro_monthly",
    yearly: "price_pro_yearly"
  },
  CHAMPION: {
    monthly: "price_champion_monthly", 
    yearly: "price_champion_yearly"
  }
};

// Subscription tier features
export const TIER_FEATURES = {
  ROOKIE: {
    personas: ["rookie"],
    maxConversations: 10,
    voiceEnabled: false,
    advancedAnalytics: false
  },
  PRO: {
    personas: ["rookie", "oracle", "rebel", "mentor"],
    maxConversations: 100,
    voiceEnabled: true,
    advancedAnalytics: true
  },
  CHAMPION: {
    personas: ["rookie", "oracle", "rebel", "mentor", "analyst", "zane"],
    maxConversations: -1, // unlimited
    voiceEnabled: true,
    advancedAnalytics: true
  }
};

