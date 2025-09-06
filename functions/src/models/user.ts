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
    preferredName?: string; // NEW: User's preferred name for personalization
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
  preferredName?: string; // NEW: Optional preferred name during user creation
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

// NEW: Interface for preferred name operations
export interface PreferredNameUpdateData {
  preferredName: string;
  updatedAt: Date;
}

export interface PreferredNameValidation {
  isValid: boolean;
  errors: string[];
  sanitizedName?: string;
}

