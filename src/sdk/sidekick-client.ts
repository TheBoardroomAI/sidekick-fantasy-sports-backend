/**
 * Frontend SDK for Sidekick Selection System with PreferredName Support
 * @file src/sdk/sidekick-client.ts
 */

import {
  SidekickPersona,
  UserSidekickSelection,
  SidekickPreferences,
  SidekickSelectionContext,
  SidekickFilters,
  SubscriptionTier,
  SidekickAPIResponse,
  SidekickError
} from '../types/sidekick';

import {
  ISidekickClient,
  SidekickClientConfig,
  SidekickClientEvent,
  SidekickEventHandler
} from '../interfaces/sidekick-client';

// NEW: Interface for sidekick selection with preferred name
export interface SidekickSelectionWithName {
  sidekickId: string;
  preferredName: string;
  preferences?: SidekickPreferences;
}

// NEW: Interface for preferred name update
export interface PreferredNameUpdate {
  preferredName: string;
}

/**
 * Main Sidekick Client SDK
 */
export class SidekickClient implements ISidekickClient {
  private config: SidekickClientConfig;
  private eventHandlers: Map<SidekickClientEvent, SidekickEventHandler[]>;
  private cache: Map<string, { data: any; expiry: number }>;

  constructor(initialConfig: SidekickClientConfig) {
    this.config = {
      timeout: 10000,
      retryAttempts: 3,
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      enableAnalytics: true,
      ...initialConfig
    };

    this.eventHandlers = new Map();
    this.cache = new Map();

    // Initialize event handlers
    Object.values([
      'selection_changed',
      'preferences_updated',
      'preferred_name_updated', // NEW: Event for preferred name changes
      'error',
      'network_error',
      'auth_error',
      'cache_updated',
      'recommendation_received'
    ] as SidekickClientEvent[]).forEach(event => {
      this.eventHandlers.set(event, []);
    });
  }

  // Configuration
  configure(config: Partial<SidekickClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Authentication
  setAuthToken(token: string): void {
    this.config.authToken = token;
  }

  clearAuthToken(): void {
    this.config.authToken = undefined;
  }

  // Sidekick Management
  async getAvailableSidekicks(tier: SubscriptionTier = 'free'): Promise<SidekickPersona[]> {
    const cacheKey = `available_sidekicks_${tier}`;

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.makeRequest<{
        sidekicks: SidekickPersona[];
        count: number;
        subscriptionTier: SubscriptionTier;
      }>('/api/sidekicks/available', 'GET', undefined, { tier });

      const sidekicks = response.data?.sidekicks || [];

      if (this.config.enableCaching) {
        this.setCache(cacheKey, sidekicks);
        this.emitEvent('cache_updated', { key: cacheKey, count: sidekicks.length });
      }

      return sidekicks;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async getRecommendedSidekicks(context?: Partial<SidekickSelectionContext>): Promise<SidekickPersona[]> {
    try {
      const response = await this.makeRequest<{
        recommendations: SidekickPersona[];
        count: number;
        context: any;
      }>('/api/sidekicks/recommended', 'GET', undefined, context);

      const recommendations = response.data?.recommendations || [];

      this.emitEvent('recommendation_received', { 
        count: recommendations.length,
        context: response.data?.context 
      });

      return recommendations;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // Legacy selection method (maintains backward compatibility)
  async selectSidekick(sidekickId: string, preferences?: SidekickPreferences): Promise<UserSidekickSelection> {
    try {
      const response = await this.makeRequest<{
        selection: UserSidekickSelection;
        message: string;
      }>('/api/sidekicks/select', 'POST', { sidekickId, preferences });

      const selection = response.data?.selection;
      if (!selection) {
        throw new Error('Invalid response from server');
      }

      this.clearCacheByPattern('available_sidekicks_');
      this.emitEvent('selection_changed', { selection, method: 'legacy' });

      return selection;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // NEW: Select sidekick with preferred name
  async selectSidekickWithName(selectionData: SidekickSelectionWithName): Promise<UserSidekickSelection> {
    try {
      // Validate preferred name before sending
      const validation = this.validatePreferredName(selectionData.preferredName);
      if (!validation.isValid) {
        throw new SidekickError(
          'VALIDATION_ERROR',
          `Invalid preferred name: ${validation.errors.join(', ')}`
        );
      }

      const response = await this.makeRequest<{
        selection: UserSidekickSelection;
        message: string;
      }>('/api/sidekicks/select-with-name', 'POST', selectionData);

      const selection = response.data?.selection;
      if (!selection) {
        throw new Error('Invalid response from server');
      }

      this.clearCacheByPattern('available_sidekicks_');
      this.clearCache('current_selection');

      this.emitEvent('selection_changed', { 
        selection, 
        method: 'with_name',
        preferredName: selectionData.preferredName 
      });

      return selection;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // NEW: Update preferred name for current selection
  async updatePreferredName(preferredName: string): Promise<void> {
    try {
      // Validate preferred name before sending
      const validation = this.validatePreferredName(preferredName);
      if (!validation.isValid) {
        throw new SidekickError(
          'VALIDATION_ERROR',
          `Invalid preferred name: ${validation.errors.join(', ')}`
        );
      }

      const response = await this.makeRequest<{
        preferredName: string;
        message: string;
      }>('/api/sidekicks/preferred-name', 'PUT', { preferredName });

      this.clearCache('current_selection');

      this.emitEvent('preferred_name_updated', { 
        preferredName: response.data?.preferredName || preferredName,
        message: response.data?.message 
      });

    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // NEW: Get current selection with preferred name
  async getCurrentSelection(): Promise<{
    hasSelection: boolean;
    currentSidekick?: SidekickPersona;
    selectionData?: UserSidekickSelection;
  }> {
    const cacheKey = 'current_selection';

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.makeRequest<{
        hasSelection: boolean;
        currentSidekick?: SidekickPersona;
        selectionData?: UserSidekickSelection;
      }>('/api/sidekicks/current', 'GET');

      const selectionStatus = response.data || { hasSelection: false };

      if (this.config.enableCaching) {
        this.setCache(cacheKey, selectionStatus);
      }

      return selectionStatus;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // NEW: Remove current sidekick selection
  async removeSelection(): Promise<void> {
    try {
      const response = await this.makeRequest<{
        message: string;
      }>('/api/sidekicks/selection', 'DELETE');

      this.clearCache('current_selection');
      this.clearCacheByPattern('available_sidekicks_');

      this.emitEvent('selection_changed', { 
        selection: null, 
        method: 'removed',
        message: response.data?.message 
      });

    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // NEW: Validate preferred name on client side
  validatePreferredName(preferredName: string): {
    isValid: boolean;
    errors: string[];
    sanitizedName?: string;
  } {
    const errors: string[] = [];

    if (!preferredName || typeof preferredName !== 'string') {
      errors.push('Preferred name is required');
      return { isValid: false, errors };
    }

    const trimmedName = preferredName.trim();

    if (trimmedName.length < 1) {
      errors.push('Preferred name must be at least 1 character long');
    }

    if (trimmedName.length > 50) {
      errors.push('Preferred name must be 50 characters or less');
    }

    const validNamePattern = /^[a-zA-Z0-9\s\-']+$/;
    if (!validNamePattern.test(trimmedName)) {
      errors.push('Preferred name contains invalid characters. Only letters, numbers, spaces, hyphens, and apostrophes are allowed');
    }

    if (/\s{2,}/.test(trimmedName)) {
      errors.push('Preferred name cannot contain multiple consecutive spaces');
    }

    if (trimmedName !== preferredName) {
      errors.push('Preferred name cannot start or end with spaces');
    }

    const sanitizedName = trimmedName
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedName: errors.length === 0 ? sanitizedName : undefined
    };
  }

  // Analytics (Enhanced for preferredName tracking)
  async trackSidekickInteraction(event: string, data?: any): Promise<void> {
    if (!this.config.enableAnalytics) return;

    try {
      const analyticsData = {
        event,
        timestamp: new Date().toISOString(),
        userId: this.config.userId,
        sessionId: this.config.sessionId,
        ...data
      };

      // Enhanced analytics for preferred name events
      if (event === 'preferred_name_updated' || event === 'selection_with_name') {
        analyticsData.hasPreferredName = !!data?.preferredName;
        analyticsData.preferredNameLength = data?.preferredName?.length || 0;
      }

      await this.makeRequest('/api/analytics/sidekick-interaction', 'POST', analyticsData);
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  // Event Management
  on(event: SidekickClientEvent, handler: SidekickEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: SidekickClientEvent, handler: SidekickEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  private emitEvent(event: SidekickClientEvent, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
      }
    });
  }

  // Cache Management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.config.cacheTimeout
    });
  }

  private clearCache(key: string): void {
    this.cache.delete(key);
  }

  private clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // HTTP Client
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
    params?: Record<string, any>
  ): Promise<SidekickAPIResponse<T>> {
    const url = new URL(endpoint, this.config.baseURL);

    if (params && method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.authToken) {
      headers.Authorization = `Bearer ${this.config.authToken}`;
    }

    const requestConfig: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout)
    };

    if (body && method !== 'GET') {
      requestConfig.body = JSON.stringify(body);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url.toString(), requestConfig);

        if (!response.ok) {
          throw new SidekickError(
            response.status === 401 ? 'AUTH_ERROR' : 'API_ERROR',
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: SidekickAPIResponse<T> = await response.json();
        return data;

      } catch (error) {
        lastError = error as Error;

        if (attempt === this.config.retryAttempts) {
          break;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError;
  }

  private handleError(error: Error): void {
    if (error instanceof SidekickError) {
      if (error.code === 'AUTH_ERROR') {
        this.emitEvent('auth_error', error);
      } else {
        this.emitEvent('error', error);
      }
    } else {
      this.emitEvent('network_error', error);
    }

    if (this.config.enableAnalytics) {
      this.trackSidekickInteraction('error', {
        error: error.message,
        type: error.constructor.name
      }).catch(console.warn);
    }
  }
}

// Export types
export {
  SidekickPersona,
  UserSidekickSelection,
  SidekickPreferences,
  SidekickSelectionContext,
  SidekickFilters,
  SubscriptionTier,
  SidekickAPIResponse,
  SidekickError,
  ISidekickClient,
  SidekickClientConfig,
  SidekickClientEvent,
  SidekickEventHandler
};
