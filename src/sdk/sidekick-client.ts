/**
 * Frontend SDK for Sidekick Selection System
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
      this.emitEvent('recommendation_received', { recommendations, count: recommendations.length });

      return recommendations;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async getSidekickById(id: string): Promise<SidekickPersona> {
    const cacheKey = `sidekick_${id}`;

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.makeRequest<SidekickPersona>(`/api/sidekicks/${id}`, 'GET');

      if (!response.data) {
        throw new SidekickError('Sidekick not found', 'SIDEKICK_NOT_FOUND', 404);
      }

      if (this.config.enableCaching) {
        this.setCache(cacheKey, response.data);
      }

      return response.data;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async searchSidekicks(query: string, filters?: SidekickFilters): Promise<SidekickPersona[]> {
    try {
      const searchParams = { query, ...filters };
      const response = await this.makeRequest<{
        sidekicks: SidekickPersona[];
        count: number;
      }>('/api/sidekicks/search', 'GET', undefined, searchParams);

      return response.data?.sidekicks || [];
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // Selection Management
  async selectSidekick(sidekickId: string, preferences: SidekickPreferences): Promise<UserSidekickSelection> {
    try {
      const response = await this.makeRequest<{
        selection: UserSidekickSelection;
        message: string;
      }>('/api/sidekicks/select', 'POST', { sidekickId, preferences });

      if (!response.data?.selection) {
        throw new SidekickError('Failed to create selection', 'SELECTION_FAILED', 500);
      }

      // Clear cache for current selection
      this.removeFromCache('current_selection');
      this.removeFromCache('available_sidekicks_*');

      this.emitEvent('selection_changed', response.data.selection);

      if (this.config.enableAnalytics) {
        this.trackEvent('sidekick_selected', { sidekickId, preferences });
      }

      return response.data.selection;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async getCurrentSelection(): Promise<UserSidekickSelection | null> {
    const cacheKey = 'current_selection';

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    try {
      const response = await this.makeRequest<{
        selection: UserSidekickSelection | null;
        hasSelection: boolean;
      }>('/api/sidekicks/current', 'GET');

      const selection = response.data?.selection || null;

      if (this.config.enableCaching) {
        this.setCache(cacheKey, selection);
      }

      return selection;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async updatePreferences(preferences: Partial<SidekickPreferences>): Promise<void> {
    try {
      await this.makeRequest('/api/sidekicks/preferences', 'PUT', { preferences });

      // Clear current selection cache
      this.removeFromCache('current_selection');

      this.emitEvent('preferences_updated', preferences);

      if (this.config.enableAnalytics) {
        this.trackEvent('preferences_updated', preferences);
      }
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  async getSelectionHistory(limit: number = 10): Promise<UserSidekickSelection[]> {
    try {
      const response = await this.makeRequest<{
        history: UserSidekickSelection[];
        count: number;
        limit: number;
      }>('/api/sidekicks/history', 'GET', undefined, { limit });

      return response.data?.history || [];
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  // Events
  addEventListener(event: SidekickClientEvent, handler: SidekickEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  removeEventListener(event: SidekickClientEvent, handler: SidekickEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  // Private methods
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    queryParams?: Record<string, any>
  ): Promise<SidekickAPIResponse<T>> {
    let url = `${this.config.apiBaseUrl}${endpoint}`;

    if (queryParams) {
      const searchParams = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const requestConfig: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout || 10000)
    };

    if (body && method !== 'GET') {
      requestConfig.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= (this.config.retryAttempts || 1); attempt++) {
      try {
        const response = await fetch(url, requestConfig);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new SidekickError(
            errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            errorData.code || 'HTTP_ERROR',
            response.status,
            errorData
          );
        }

        const data: SidekickAPIResponse<T> = await response.json();

        if (!data.success) {
          throw new SidekickError(
            data.error || 'Request failed',
            'API_ERROR',
            500,
            data
          );
        }

        return data;
      } catch (error) {
        lastError = error as Error;

        if (attempt === (this.config.retryAttempts || 1)) {
          break;
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError;
  }

  private emitEvent(event: SidekickClientEvent, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  private handleError(error: Error): void {
    this.emitEvent('error', error);

    if (error.name === 'AbortError' || error.message.includes('fetch')) {
      this.emitEvent('network_error', error);
    }

    if (error instanceof SidekickError && error.statusCode === 401) {
      this.emitEvent('auth_error', error);
    }
  }

  private getFromCache(key: string): any | null {
    if (!this.config.enableCaching) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: any): void {
    if (!this.config.enableCaching) return;

    this.cache.set(key, {
      data,
      expiry: Date.now() + (this.config.cacheTimeout || 300000)
    });
  }

  private removeFromCache(pattern: string): void {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.delete(pattern);
    }
  }

  private trackEvent(event: string, data: any): void {
    // Implement analytics tracking
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track(`Sidekick ${event}`, data);
    }
  }
}

/**
 * Create a configured sidekick client instance
 */
export function createSidekickClient(config: SidekickClientConfig): SidekickClient {
  return new SidekickClient(config);
}

/**
 * Default client instance (singleton)
 */
let defaultClient: SidekickClient | null = null;

export function getDefaultSidekickClient(): SidekickClient {
  if (!defaultClient) {
    throw new Error('Default sidekick client not initialized. Call initializeSidekickClient first.');
  }
  return defaultClient;
}

export function initializeSidekickClient(config: SidekickClientConfig): SidekickClient {
  defaultClient = new SidekickClient(config);
  return defaultClient;
}

export function resetSidekickClient(): void {
  defaultClient = null;
}
