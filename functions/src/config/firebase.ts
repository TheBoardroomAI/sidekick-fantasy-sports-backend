import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

// Firestore collections
export const COLLECTIONS = {
  USERS: "users",
  SUBSCRIPTIONS: "subscriptions",
  CONVERSATIONS: "conversations",
  PERSONAS: "personas",
  PLAYER_DATA: "player_data",
  VOICE_CACHE: "voice_cache"
};

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  ROOKIE: "rookie",
  PRO: "pro", 
  CHAMPION: "champion"
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

