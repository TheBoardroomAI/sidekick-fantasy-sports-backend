import { SubscriptionTier } from "../config/firebase";

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus: "active" | "inactive" | "canceled" | "past_due";
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  preferences: {
    favoriteTeams: string[];
    notifications: boolean;
    voiceEnabled: boolean;
    selectedPersona?: string;
  };
  usage: {
    conversationsThisMonth: number;
    lastResetDate: Date;
  };
}

export interface CreateUserData {
  email: string;
  displayName?: string;
  subscriptionTier: SubscriptionTier;
  favoriteTeams?: string[];
}

export interface UpdateUserData {
  displayName?: string;
  photoURL?: string;
  preferences?: Partial<User["preferences"]>;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: User["subscriptionStatus"];
  stripeCustomerId?: string;
  subscriptionId?: string;
}

