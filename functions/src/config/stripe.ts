import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

// Define the secret parameter
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

// Lazy initialization function - only called at runtime
export function getStripeClient(): Stripe {
  const secretValue = stripeSecretKey.value();

  if (!secretValue) {
    throw new Error("Stripe secret key not found in Firebase Secret Manager");
  }

  return new Stripe(secretValue, {
    apiVersion: "2025-07-30.basil",
  });
}

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

