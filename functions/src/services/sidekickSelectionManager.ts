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

        // Match sports preferences
        const sportMatches = sidekick.sports.filter(sport => 
          context.preferredSports.includes(sport)
        ).length;
        score += sportMatches * 10;

        // Prefer sidekicks with features user has used
        if (context.usageHistory.some(h => h.feature === 'voice') && sidekick.features.voice) {
          score += 5;
        }
        if (context.usageHistory.some(h => h.feature === 'realtime') && sidekick.features.realtime) {
          score += 5;
        }

        return { sidekick, score };
      });

      // Sort by score and return top 3
      scoredSidekicks.sort((a, b) => b.score - a.score);

      logger.info(`Generated ${scoredSidekicks.length} recommendations for user ${userId}`);
      return scoredSidekicks.slice(0, 3).map(item => item.sidekick);

    } catch (error) {
      logger.error('Error getting recommended sidekicks:', error);
      throw new Error('Failed to generate sidekick recommendations');
    }
  }

  /**
   * Select a sidekick for a user
   */
  async selectSidekick(
    userId: string,
    sidekickId: string,
    preferences: UserSidekickSelection['preferences']
  ): Promise<UserSidekickSelection> {
    try {
      // Verify sidekick exists and is available
      const sidekickDoc = await this.db.collection('sidekicks').doc(sidekickId).get();

      if (!sidekickDoc.exists) {
        throw new Error('Sidekick not found');
      }

      const sidekick = sidekickDoc.data() as SidekickPersona;
      if (!sidekick.isActive) {
        throw new Error('Sidekick is not currently available');
      }

      // Get user's subscription to verify access
      const userDoc = await this.db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (!userData) {
        throw new Error('User not found');
      }

      const userTier = userData.subscription?.tier || 'free';

      // Check if user has access to this sidekick
      if (!this.hasAccessToSidekick(sidekick, userTier)) {
        throw new Error('Insufficient subscription tier for this sidekick');
      }

      // Deactivate current selection if exists
      await this.deactivateCurrentSelection(userId);

      // Create new selection
      const selection: UserSidekickSelection = {
        userId,
        selectedSidekickId: sidekickId,
        selectionDate: admin.firestore.Timestamp.now(),
        isActive: true,
        preferences,
        subscriptionTier: userTier
      };

      const selectionRef = this.db.collection('userSidekickSelections').doc();
      await selectionRef.set(selection);

      // Update user document with current sidekick
      await this.db.collection('users').doc(userId).update({
        currentSidekickId: sidekickId,
        lastSidekickSelection: admin.firestore.Timestamp.now()
      });

      logger.info(`User ${userId} selected sidekick ${sidekickId}`);
      return selection;

    } catch (error) {
      logger.error('Error selecting sidekick:', error);
      throw error;
    }
  }

  /**
   * Get user's current sidekick selection
   */
  async getCurrentSelection(userId: string): Promise<UserSidekickSelection | null> {
    try {
      const snapshot = await this.db
        .collection('userSidekickSelections')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .orderBy('selectionDate', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        ...doc.data(),
        id: doc.id
      } as UserSidekickSelection;

    } catch (error) {
      logger.error('Error getting current selection:', error);
      throw new Error('Failed to retrieve current sidekick selection');
    }
  }

  /**
   * Update sidekick preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserSidekickSelection['preferences']>
  ): Promise<void> {
    try {
      const currentSelection = await this.getCurrentSelection(userId);

      if (!currentSelection) {
        throw new Error('No active sidekick selection found');
      }

      await this.db
        .collection('userSidekickSelections')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get()
        .then(snapshot => {
          const batch = this.db.batch();
          snapshot.forEach(doc => {
            batch.update(doc.ref, {
              'preferences': { ...currentSelection.preferences, ...preferences }
            });
          });
          return batch.commit();
        });

      logger.info(`Updated preferences for user ${userId}`);

    } catch (error) {
      logger.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get sidekick selection history for a user
   */
  async getSelectionHistory(userId: string, limit: number = 10): Promise<UserSidekickSelection[]> {
    try {
      const snapshot = await this.db
        .collection('userSidekickSelections')
        .where('userId', '==', userId)
        .orderBy('selectionDate', 'desc')
        .limit(limit)
        .get();

      const history: UserSidekickSelection[] = [];

      snapshot.forEach(doc => {
        history.push({
          ...doc.data(),
          id: doc.id
        } as UserSidekickSelection);
      });

      return history;

    } catch (error) {
      logger.error('Error getting selection history:', error);
      throw new Error('Failed to retrieve sidekick selection history');
    }
  }

  /**
   * Deactivate current sidekick selection
   */
  private async deactivateCurrentSelection(userId: string): Promise<void> {
    const snapshot = await this.db
      .collection('userSidekickSelections')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    const batch = this.db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, { isActive: false });
    });

    await batch.commit();
  }

  /**
   * Check if user has access to a sidekick based on subscription tier
   */
  private hasAccessToSidekick(sidekick: SidekickPersona, userTier: string): boolean {
    if (sidekick.pricing.tier === 'free') return true;
    if (sidekick.pricing.tier === 'premium') return ['premium', 'pro'].includes(userTier);
    if (sidekick.pricing.tier === 'pro') return userTier === 'pro';
    return false;
  }

  /**
   * Initialize default sidekicks (for setup)
   */
  async initializeDefaultSidekicks(): Promise<void> {
    try {
      const defaultSidekicks: Partial<SidekickPersona>[] = [
        {
          name: 'Alex Analytics',
          description: 'Your data-driven fantasy sports analyst specializing in statistical insights and trend analysis.',
          expertise: ['Statistics', 'Trend Analysis', 'Player Performance', 'Matchup Analysis'],
          tone: 'analytical',
          sports: ['NFL', 'NBA', 'MLB', 'NHL'],
          isActive: true,
          features: {
            voice: true,
            realtime: true,
            analysis: true,
            recommendations: true
          },
          pricing: {
            tier: 'free',
            monthlyPrice: 0
          }
        },
        {
          name: 'Coach Mike',
          description: 'A motivational fantasy coach who helps you stay positive and make confident decisions.',
          expertise: ['Team Strategy', 'Motivation', 'Decision Making', 'Risk Management'],
          tone: 'motivational',
          sports: ['NFL', 'NBA', 'MLB'],
          isActive: true,
          features: {
            voice: true,
            realtime: false,
            analysis: true,
            recommendations: true
          },
          pricing: {
            tier: 'premium',
            monthlyPrice: 9.99
          }
        },
        {
          name: 'Sarah Pro',
          description: 'Elite fantasy sports strategist with advanced analytics and real-time insights.',
          expertise: ['Advanced Analytics', 'Real-time Updates', 'Multi-sport Strategy', 'Portfolio Management'],
          tone: 'professional',
          sports: ['NFL', 'NBA', 'MLB', 'NHL', 'Soccer'],
          isActive: true,
          features: {
            voice: true,
            realtime: true,
            analysis: true,
            recommendations: true
          },
          pricing: {
            tier: 'pro',
            monthlyPrice: 19.99
          }
        }
      ];

      const batch = this.db.batch();
      const timestamp = admin.firestore.Timestamp.now();

      for (const sidekick of defaultSidekicks) {
        const ref = this.db.collection('sidekicks').doc();
        batch.set(ref, {
          ...sidekick,
          id: ref.id,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      await batch.commit();
      logger.info('Default sidekicks initialized successfully');

    } catch (error) {
      logger.error('Error initializing default sidekicks:', error);
      throw error;
    }
  }
}

export const sidekickSelectionManager = new SidekickSelectionManager();
