/**
 * Client-side interfaces for Sidekick Selection System
 * @file src/interfaces/sidekick-client.ts
 */

import {
  SidekickPersona,
  UserSidekickSelection,
  SidekickPreferences,
  SidekickAPIResponse,
  SidekickSelectionContext,
  SidekickFilters,
  SubscriptionTier
} from '../types/sidekick';

/**
 * Sidekick Client Configuration
 */
export interface SidekickClientConfig {
  apiBaseUrl: string;
  apiKey?: string;
  authToken?: string;
  timeout?: number;
  retryAttempts?: number;
  enableCaching?: boolean;
  cacheTimeout?: number;
  enableAnalytics?: boolean;
}

/**
 * Sidekick Client Interface
 */
export interface ISidekickClient {
  // Configuration
  configure(config: Partial<SidekickClientConfig>): void;

  // Authentication
  setAuthToken(token: string): void;
  clearAuthToken(): void;

  // Sidekick Management
  getAvailableSidekicks(tier?: SubscriptionTier): Promise<SidekickPersona[]>;
  getRecommendedSidekicks(context?: Partial<SidekickSelectionContext>): Promise<SidekickPersona[]>;
  getSidekickById(id: string): Promise<SidekickPersona>;
  searchSidekicks(query: string, filters?: SidekickFilters): Promise<SidekickPersona[]>;

  // Selection Management
  selectSidekick(sidekickId: string, preferences: SidekickPreferences): Promise<UserSidekickSelection>;
  getCurrentSelection(): Promise<UserSidekickSelection | null>;
  updatePreferences(preferences: Partial<SidekickPreferences>): Promise<void>;
  getSelectionHistory(limit?: number): Promise<UserSidekickSelection[]>;

  // Events
  addEventListener(event: SidekickClientEvent, handler: SidekickEventHandler): void;
  removeEventListener(event: SidekickClientEvent, handler: SidekickEventHandler): void;
}

/**
 * Client Events
 */
export type SidekickClientEvent =
  | 'selection_changed'
  | 'preferences_updated'
  | 'error'
  | 'network_error'
  | 'auth_error'
  | 'cache_updated'
  | 'recommendation_received';

export type SidekickEventHandler = (data: any) => void;

/**
 * React Hook Interfaces
 */
export interface UseSidekickSelectionOptions {
  autoFetch?: boolean;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  onError?: (error: Error) => void;
}

export interface UseSidekickSelectionReturn {
  // Current state
  currentSidekick: SidekickPersona | null;
  currentSelection: UserSidekickSelection | null;
  isLoading: boolean;
  error: Error | null;

  // Available sidekicks
  availableSidekicks: SidekickPersona[];
  recommendations: SidekickPersona[];

  // Actions
  selectSidekick: (sidekickId: string, preferences?: SidekickPreferences) => Promise<void>;
  updatePreferences: (preferences: Partial<SidekickPreferences>) => Promise<void>;
  refreshSidekicks: () => Promise<void>;
  clearError: () => void;

  // Status flags
  hasActiveSelection: boolean;
  canSelectPremium: boolean;
  canSelectPro: boolean;
}

export interface UseAvailableSidekicksReturn {
  sidekicks: SidekickPersona[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  filterBySport: (sport: string) => SidekickPersona[];
  filterByTier: (tier: SubscriptionTier) => SidekickPersona[];
}

export interface UseRecommendationsReturn {
  recommendations: SidekickPersona[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  acceptRecommendation: (sidekickId: string) => Promise<void>;
}

/**
 * Component Props Interfaces
 */
export interface SidekickSelectorProps {
  onSelectionChange?: (selection: UserSidekickSelection) => void;
  onError?: (error: Error) => void;
  showRecommendations?: boolean;
  allowFiltering?: boolean;
  maxDisplayCount?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface SidekickCardProps {
  sidekick: SidekickPersona;
  isSelected?: boolean;
  isRecommended?: boolean;
  onSelect?: (sidekickId: string) => void;
  showFeatures?: boolean;
  showPricing?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface SidekickPreferencesProps {
  currentPreferences?: SidekickPreferences;
  onChange?: (preferences: SidekickPreferences) => void;
  onSave?: (preferences: SidekickPreferences) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export interface SidekickRecommendationsProps {
  recommendations?: SidekickPersona[];
  onAccept?: (sidekickId: string) => void;
  onDismiss?: () => void;
  maxItems?: number;
  showReasoning?: boolean;
  className?: string;
}

/**
 * State Management Interfaces
 */
export interface SidekickStore {
  // State
  availableSidekicks: SidekickPersona[];
  currentSelection: UserSidekickSelection | null;
  recommendations: SidekickPersona[];
  preferences: SidekickPreferences | null;

  // Loading states
  isLoading: boolean;
  isSelecting: boolean;
  isUpdatingPreferences: boolean;

  // Error state
  error: Error | null;

  // Cache metadata
  lastFetch: Date | null;
  cacheTimeout: number;

  // Actions
  actions: SidekickStoreActions;
}

export interface SidekickStoreActions {
  // Fetch operations
  fetchAvailableSidekicks: (tier?: SubscriptionTier) => Promise<void>;
  fetchRecommendations: (context?: Partial<SidekickSelectionContext>) => Promise<void>;
  fetchCurrentSelection: () => Promise<void>;

  // Selection operations
  selectSidekick: (sidekickId: string, preferences: SidekickPreferences) => Promise<void>;
  updatePreferences: (preferences: Partial<SidekickPreferences>) => Promise<void>;

  // Error handling
  setError: (error: Error | null) => void;
  clearError: () => void;

  // Cache management
  invalidateCache: () => void;
  clearCache: () => void;
}

/**
 * Service Worker Interfaces (for offline support)
 */
export interface SidekickCacheEntry {
  data: any;
  timestamp: number;
  expiry: number;
  key: string;
}

export interface SidekickOfflineManager {
  // Cache operations
  cacheData: (key: string, data: any, ttl?: number) => Promise<void>;
  getCachedData: (key: string) => Promise<any | null>;
  clearExpired: () => Promise<void>;

  // Offline queue
  queueAction: (action: OfflineAction) => Promise<void>;
  processQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export interface OfflineAction {
  type: 'select_sidekick' | 'update_preferences' | 'track_event';
  payload: any;
  timestamp: number;
  retryCount: number;
}

/**
 * Analytics Interfaces
 */
export interface SidekickAnalytics {
  // Event tracking
  trackSidekickView: (sidekickId: string) => void;
  trackSidekickSelection: (sidekickId: string, source: 'manual' | 'recommendation') => void;
  trackPreferencesUpdate: (changes: Partial<SidekickPreferences>) => void;
  trackRecommendationInteraction: (sidekickId: string, action: 'accept' | 'dismiss') => void;

  // Performance tracking
  trackLoadTime: (operation: string, duration: number) => void;
  trackError: (error: Error, context?: Record<string, any>) => void;

  // User behavior
  trackSessionStart: () => void;
  trackSessionEnd: () => void;
  trackFeatureUsage: (feature: string) => void;
}

/**
 * Utility Interfaces
 */
export interface SidekickFilterOptions {
  sports: string[];
  tiers: SubscriptionTier[];
  features: string[];
  priceRange: [number, number];
  tones: string[];
}

export interface SidekickSortOptions {
  by: 'name' | 'price' | 'rating' | 'popularity';
  order: 'asc' | 'desc';
}

export interface SidekickDisplaySettings {
  showAvatars: boolean;
  showPricing: boolean;
  showFeatures: boolean;
  showRatings: boolean;
  compactMode: boolean;
}

/**
 * Validation Interfaces
 */
export interface SidekickValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface SidekickValidator {
  validatePreferences: (preferences: SidekickPreferences) => SidekickValidationResult;
  validateSelection: (sidekickId: string, userTier: SubscriptionTier) => SidekickValidationResult;
  validateCustomizations: (customizations: any) => SidekickValidationResult;
}
