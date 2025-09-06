import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

export interface SidekickPersona {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  tone: 'professional' | 'casual' | 'analytical' | 'motivational';
  sports: string[];
  isActive: boolean;
  features: {
    voice: boolean;
    realtime: boolean;
    analysis: boolean;
    recommendations: boolean;
  };
  pricing: {
    tier: 'free' | 'premium' | 'pro';
    monthlyPrice: number;
  };
  avatar?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface UserSidekickSelection {
  userId: string;
  selectedSidekickId: string;
  selectionDate: admin.firestore.Timestamp;
  isActive: boolean;
  preferences: {
    notifications: boolean;
    voiceEnabled: boolean;
    realtimeUpdates: boolean;
  };
  subscriptionTier: 'free' | 'premium' | 'pro';
  preferredName?: string; // NEW: User's preferred name for this sidekick relationship
}

// NEW: Interface for sidekick selection with preferred name
export interface SidekickSelectionWithName {
  sidekickId: string;
  preferredName: string;
  preferences?: {
    notifications: boolean;
    voiceEnabled: boolean;
    realtimeUpdates: boolean;
  };
}

export interface SidekickSelectionContext {
  userProfile: any;
  currentSubscription: any;
  preferredSports: string[];
  usageHistory: any[];
}

export class SidekickSelectionManager {
  private db: admin.firestore.Firestore;

  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Get all available sidekicks based on user's subscription tier
   */
  async getAvailableSidekicks(
    userId: string, 
    subscriptionTier: 'free' | 'premium' | 'pro' = 'free'
  ): Promise<SidekickPersona[]> {
    try {
      const sidekicksRef = this.db.collection('sidekicks');
      let query = sidekicksRef.where('isActive', '==', true);

      // Filter by subscription tier
      if (subscriptionTier === 'free') {
        query = query.where('pricing.tier', '==', 'free');
      } else if (subscriptionTier === 'premium') {
        query = query.where('pricing.tier', 'in', ['free', 'premium']);
      }
      // Pro users get all sidekicks

      const snapshot = await query.get();
      const sidekicks: SidekickPersona[] = [];

      snapshot.forEach(doc => {
        sidekicks.push({
          id: doc.id,
          ...doc.data()
        } as SidekickPersona);
      });

      logger.info(`Retrieved ${sidekicks.length} available sidekicks for user ${userId}`);
      return sidekicks.sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
      logger.error('Error getting available sidekicks:', error);
      throw new Error('Failed to retrieve available sidekicks');
    }
  }

  /**
   * Get recommended sidekicks based on user context
   */
  async getRecommendedSidekicks(
    userId: string,
    context: SidekickSelectionContext
  ): Promise<SidekickPersona[]> {
    try {
      const availableSidekicks = await this.getAvailableSidekicks(
        userId, 
        context.currentSubscription?.tier || 'free'
      );

      // Score sidekicks based on user preferences
      const scoredSidekicks = availableSidekicks.map(sidekick => {
        let score = 0;

        // Score based on preferred sports
        if (context.preferredSports?.length > 0) {
          const sportsMatch = sidekick.sports.filter(sport => 
            context.preferredSports.includes(sport)
          ).length;
          score += sportsMatch * 10;
        }

        // Score based on subscription tier match
        if (sidekick.pricing.tier === context.currentSubscription?.tier) {
          score += 5;
        }

        // Boost active features for premium users
        if (context.currentSubscription?.tier !== 'free') {
          if (sidekick.features.voice) score += 3;
          if (sidekick.features.realtime) score += 3;
        }

        return { sidekick, score };
      });

      // Return top 5 recommendations
      return scoredSidekicks
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.sidekick);

    } catch (error) {
      logger.error('Error getting recommended sidekicks:', error);
      throw new Error('Failed to generate recommendations');
    }
  }

  /**
   * NEW: Select a sidekick with preferred name
   */
  async selectSidekickWithName(
    userId: string,
    selectionData: SidekickSelectionWithName,
    subscriptionTier: 'free' | 'premium' | 'pro' = 'free'
  ): Promise<UserSidekickSelection> {
    try {
      // Validate sidekick exists and is available to user
      const availableSidekicks = await this.getAvailableSidekicks(userId, subscriptionTier);
      const selectedSidekick = availableSidekicks.find(s => s.id === selectionData.sidekickId);

      if (!selectedSidekick) {
        throw new Error('Sidekick not found or not available for your subscription tier');
      }

      // Create selection with preferred name
      const selection: UserSidekickSelection = {
        userId,
        selectedSidekickId: selectionData.sidekickId,
        selectionDate: admin.firestore.Timestamp.now(),
        isActive: true,
        preferences: selectionData.preferences || {
          notifications: true,
          voiceEnabled: false,
          realtimeUpdates: false,
        },
        subscriptionTier,
        preferredName: selectionData.preferredName // Store the preferred name
      };

      // Store in Firestore
      const selectionRef = this.db.collection('userSidekickSelections').doc(userId);
      await selectionRef.set(selection, { merge: true });

      // Update user preferences with selected persona and preferred name
      const userRef = this.db.collection('users').doc(userId);
      await userRef.update({
        'preferences.selectedPersona': selectionData.sidekickId,
        'preferences.preferredName': selectionData.preferredName,
        updatedAt: admin.firestore.Timestamp.now()
      });

      logger.info(`User ${userId} selected sidekick ${selectionData.sidekickId} with preferred name: ${selectionData.preferredName}`);
      return selection;

    } catch (error) {
      logger.error('Error selecting sidekick with preferred name:', error);
      throw error;
    }
  }

  /**
   * NEW: Update preferred name for existing sidekick selection
   */
  async updatePreferredName(
    userId: string,
    preferredName: string
  ): Promise<void> {
    try {
      const batch = this.db.batch();

      // Update user preferences
      const userRef = this.db.collection('users').doc(userId);
      batch.update(userRef, {
        'preferences.preferredName': preferredName,
        updatedAt: admin.firestore.Timestamp.now()
      });

      // Update sidekick selection
      const selectionRef = this.db.collection('userSidekickSelections').doc(userId);
      batch.update(selectionRef, {
        preferredName: preferredName,
        updatedAt: admin.firestore.Timestamp.now()
      });

      await batch.commit();

      logger.info(`Updated preferred name to "${preferredName}" for user ${userId}`);

    } catch (error) {
      logger.error('Error updating preferred name:', error);
      throw new Error('Failed to update preferred name');
    }
  }

  /**
   * NEW: Get user's current sidekick selection with preferred name
   */
  async getCurrentSelection(userId: string): Promise<UserSidekickSelection | null> {
    try {
      const selectionDoc = await this.db
        .collection('userSidekickSelections')
        .doc(userId)
        .get();

      if (!selectionDoc.exists) {
        return null;
      }

      return selectionDoc.data() as UserSidekickSelection;

    } catch (error) {
      logger.error('Error getting current selection:', error);
      throw new Error('Failed to retrieve current selection');
    }
  }

  /**
   * Get user's sidekick selection status
   */
  async getUserSelectionStatus(userId: string): Promise<{
    hasSelection: boolean;
    currentSidekick?: SidekickPersona;
    selectionData?: UserSidekickSelection;
  }> {
    try {
      const selection = await this.getCurrentSelection(userId);

      if (!selection || !selection.isActive) {
        return { hasSelection: false };
      }

      // Get sidekick details
      const sidekickDoc = await this.db
        .collection('sidekicks')
        .doc(selection.selectedSidekickId)
        .get();

      if (!sidekickDoc.exists) {
        return { hasSelection: false };
      }

      return {
        hasSelection: true,
        currentSidekick: { id: sidekickDoc.id, ...sidekickDoc.data() } as SidekickPersona,
        selectionData: selection
      };

    } catch (error) {
      logger.error('Error getting user selection status:', error);
      throw new Error('Failed to get selection status');
    }
  }
}

// Export singleton instance
export const sidekickSelectionManager = new SidekickSelectionManager();
