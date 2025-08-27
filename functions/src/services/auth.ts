import * as admin from "firebase-admin";
import * as jwt from "jsonwebtoken";
import { db, auth, COLLECTIONS } from "../config/firebase";
import { User, CreateUserData, UpdateUserData } from "../models/user";
import { getStripeClient } from "../config/stripe";

export class AuthService {
  // Export auth for route access
  static auth = auth;
  
  /**
   * Create a new user in Firestore
   */
  static async createUser(userData: CreateUserData): Promise<User> {
    try {
      // Create Stripe customer
      const stripe = getStripeClient(); // Lazy initialization
      const stripeCustomer = await stripe.customers.create({
        email: userData.email,
        name: userData.displayName,
        metadata: {
          subscriptionTier: userData.subscriptionTier
        }
      });

      const now = new Date();
      const user: User = {
        uid: "", // Will be set after Firebase Auth user creation
        email: userData.email,
        displayName: userData.displayName,
        subscriptionTier: userData.subscriptionTier,
        stripeCustomerId: stripeCustomer.id,
        subscriptionStatus: "inactive",
        createdAt: now,
        updatedAt: now,
        preferences: {
          favoriteTeams: userData.favoriteTeams || [],
          notifications: true,
          voiceEnabled: userData.subscriptionTier !== "rookie",
          selectedPersona: userData.subscriptionTier === "rookie" ? "rookie" : undefined
        },
        usage: {
          conversationsThisMonth: 0,
          lastResetDate: now
        }
      };

      return user;
    } catch (error: any) {
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  /**
   * Get user by UID
   */
  static async getUserByUid(uid: string): Promise<User | null> {
    try {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
      
      if (!userDoc.exists) {
        return null;
      }

      return { uid, ...userDoc.data() } as User;
    } catch (error: any) {
      throw new Error(`Failed to get user: ${error}`);
    }
  }

  /**
   * Update user data
   */
  static async updateUser(uid: string, updateData: UpdateUserData): Promise<User> {
    try {
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };

      await db.collection(COLLECTIONS.USERS).doc(uid).update(updatePayload);
      
      const updatedUser = await this.getUserByUid(uid);
      if (!updatedUser) {
        throw new Error("User not found after update");
      }

      return updatedUser;
    } catch (error: any) {
      throw new Error(`Failed to update user: ${error}`);
    }
  }

  /**
   * Verify Firebase ID token
   */
  static async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      return await auth.verifyIdToken(idToken);
    } catch (error: any) {
      throw new Error(`Invalid ID token: ${error}`);
    }
  }

  /**
   * Generate custom JWT token for API access
   */
  static generateApiToken(user: User): string {
    const payload = {
      uid: user.uid,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus
    };

    // Use Firebase project ID as secret (in production, use a proper secret)
    const secret = process.env.JWT_SECRET || "sidekicksportsapp-02823395";
    
    return jwt.sign(payload, secret, { 
      expiresIn: "24h",
      issuer: "sidekick-fantasy-sports"
    });
  }

  /**
   * Verify API token
   */
  static verifyApiToken(token: string): any {
    try {
      const secret = process.env.JWT_SECRET || "sidekicksportsapp-02823395";
      return jwt.verify(token, secret);
    } catch (error: any) {
      throw new Error(`Invalid API token: ${error}`);
    }
  }

  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(uid: string): Promise<void> {
    try {
      await db.collection(COLLECTIONS.USERS).doc(uid).update({
        lastLoginAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error: any) {
      throw new Error(`Failed to update last login: ${error}`);
    }
  }
}

