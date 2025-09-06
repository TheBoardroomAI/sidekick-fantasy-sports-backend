/**
 * TypeScript type definitions for Sidekick Selection System
 * @file src/types/sidekick.ts
 */

import { Timestamp } from 'firebase/firestore';

export type SubscriptionTier = 'free' | 'premium' | 'pro';
export type SidekickTone = 'professional' | 'casual' | 'analytical' | 'motivational';
export type SupportedSport = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'Soccer' | 'PGA' | 'F1';

/**
 * Sidekick persona definition
 */
export interface SidekickPersona {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  tone: SidekickTone;
  sports: SupportedSport[];
  isActive: boolean;
  features: SidekickFeatures;
  pricing: SidekickPricing;
  avatar?: string;
  customization?: SidekickCustomization;
  metadata: SidekickMetadata;
}

/**
 * Sidekick feature availability
 */
export interface SidekickFeatures {
  voice: boolean;
  realtime: boolean;
  analysis: boolean;
  recommendations: boolean;
  multiSport: boolean;
  customization: boolean;
  voiceCommands?: string[];
  supportedLanguages?: string[];
}

/**
 * Sidekick pricing information
 */
export interface SidekickPricing {
  tier: SubscriptionTier;
  monthlyPrice: number;
  yearlyPrice?: number;
  trialDays?: number;
  features?: string[];
}

/**
 * Sidekick customization options
 */
export interface SidekickCustomization {
  allowNameChange: boolean;
  allowToneAdjustment: boolean;
  allowSportPreferences: boolean;
  voiceOptions?: VoiceOption[];
  personalityTraits?: PersonalityTrait[];
}

/**
 * Voice option for sidekick
 */
export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  language: string;
  premium?: boolean;
}

/**
 * Personality trait configuration
 */
export interface PersonalityTrait {
  name: string;
  description: string;
  level: 'low' | 'medium' | 'high';
  affects: string[];
}

/**
 * Sidekick metadata
 */
export interface SidekickMetadata {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: string;
  createdBy?: string;
  tags?: string[];
  rating?: number;
  usageCount?: number;
}

/**
 * User's sidekick selection record
 */
export interface UserSidekickSelection {
  id?: string;
  userId: string;
  selectedSidekickId: string;
  selectionDate: Timestamp;
  isActive: boolean;
  preferences: SidekickPreferences;
  subscriptionTier: SubscriptionTier;
  customizations?: UserCustomizations;
  metadata?: SelectionMetadata;
}

/**
 * User preferences for their selected sidekick
 */
export interface SidekickPreferences {
  notifications: boolean;
  voiceEnabled: boolean;
  realtimeUpdates: boolean;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  communicationStyle: 'formal' | 'casual' | 'technical';
  updateFrequency: 'immediate' | 'hourly' | 'daily';
  preferredSports?: SupportedSport[];
  timezone?: string;
}

/**
 * User customizations for their sidekick
 */
export interface UserCustomizations {
  customName?: string;
  selectedVoice?: string;
  personalityAdjustments?: Record<string, number>;
  preferredTopics?: string[];
  communicationPreferences?: CommunicationPreferences;
}

/**
 * Communication preferences
 */
export interface CommunicationPreferences {
  greetingStyle: 'friendly' | 'professional' | 'brief';
  useEmojis: boolean;
  verbosity: 'concise' | 'normal' | 'detailed';
  humor: 'none' | 'light' | 'frequent';
  technicalLevel: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Selection metadata
 */
export interface SelectionMetadata {
  source: 'recommendation' | 'manual' | 'upgrade';
  previousSelections?: string[];
  selectionReason?: string;
  satisfaction?: number;
  lastInteraction?: Timestamp;
  totalInteractions?: number;
}

/**
 * Context for sidekick recommendations
 */
export interface SidekickSelectionContext {
  userProfile: UserProfile;
  currentSubscription: UserSubscription;
  preferredSports: SupportedSport[];
  usageHistory: UsageHistoryEntry[];
  behaviorData?: BehaviorData;
}

/**
 * User profile information
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'expert';
  primarySports: SupportedSport[];
  joinDate: Timestamp;
  lastActive?: Timestamp;
  preferences?: UserGlobalPreferences;
}

/**
 * User subscription information
 */
export interface UserSubscription {
  tier: SubscriptionTier;
  status: 'active' | 'inactive' | 'trial' | 'cancelled';
  startDate: Timestamp;
  endDate?: Timestamp;
  autoRenew: boolean;
  paymentMethod?: string;
  features: string[];
}

/**
 * Usage history entry
 */
export interface UsageHistoryEntry {
  timestamp: Timestamp;
  feature: string;
  duration?: number;
  sport?: SupportedSport;
  satisfaction?: number;
  context?: Record<string, any>;
}

/**
 * User behavior data for recommendations
 */
export interface BehaviorData {
  preferredInteractionTimes: number[];
  averageSessionLength: number;
  mostUsedFeatures: string[];
  sportEngagement: Record<SupportedSport, number>;
  responsePatterns: Record<string, number>;
}

/**
 * Global user preferences
 */
export interface UserGlobalPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  types: NotificationType[];
}

export type NotificationType = 
  | 'game_updates'
  | 'player_news'
  | 'recommendations'
  | 'price_changes'
  | 'system_updates';

/**
 * Privacy settings
 */
export interface PrivacySettings {
  shareUsageData: boolean;
  allowAnalytics: boolean;
  showInLeaderboards: boolean;
  profileVisibility: 'public' | 'friends' | 'private';
}

/**
 * API Response types
 */
export interface SidekickAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string[];
  timestamp?: Timestamp;
  requestId?: string;
}

export interface SidekickListResponse extends SidekickAPIResponse {
  data: {
    sidekicks: SidekickPersona[];
    count: number;
    subscriptionTier: SubscriptionTier;
    filters?: Record<string, any>;
  };
}

export interface SidekickSelectionResponse extends SidekickAPIResponse {
  data: {
    selection: UserSidekickSelection;
    sidekick?: SidekickPersona;
    message: string;
  };
}

export interface SidekickRecommendationsResponse extends SidekickAPIResponse {
  data: {
    recommendations: SidekickPersona[];
    count: number;
    context: {
      preferredSports: SupportedSport[];
      subscriptionTier: SubscriptionTier;
      reasoning?: string[];
    };
  };
}

/**
 * Filter and search types
 */
export interface SidekickFilters {
  sports?: SupportedSport[];
  tones?: SidekickTone[];
  features?: (keyof SidekickFeatures)[];
  priceRange?: {
    min: number;
    max: number;
  };
  tier?: SubscriptionTier[];
  rating?: {
    min: number;
    max: number;
  };
}

export interface SidekickSearchCriteria {
  query?: string;
  filters?: SidekickFilters;
  sortBy?: 'name' | 'rating' | 'price' | 'popularity' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Event types for analytics and tracking
 */
export interface SidekickEvent {
  type: SidekickEventType;
  timestamp: Timestamp;
  userId: string;
  sidekickId?: string;
  data?: Record<string, any>;
  session?: string;
}

export type SidekickEventType =
  | 'sidekick_viewed'
  | 'sidekick_selected'
  | 'sidekick_deselected'
  | 'preferences_updated'
  | 'interaction_started'
  | 'interaction_completed'
  | 'feature_used'
  | 'recommendation_clicked'
  | 'subscription_upgraded';

/**
 * Error types
 */
export class SidekickError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(message: string, code: string, statusCode: number = 500, details?: Record<string, any>) {
    super(message);
    this.name = 'SidekickError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export type SidekickErrorCode =
  | 'SIDEKICK_NOT_FOUND'
  | 'SIDEKICK_NOT_AVAILABLE'
  | 'INSUFFICIENT_SUBSCRIPTION'
  | 'INVALID_PREFERENCES'
  | 'USER_NOT_FOUND'
  | 'SELECTION_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'SERVER_ERROR';
