/**
 * React Hooks for Sidekick Selection System
 * @file src/hooks/useSidekickSelection.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SidekickPersona,
  UserSidekickSelection,
  SidekickPreferences,
  SidekickSelectionContext,
  SubscriptionTier
} from '../types/sidekick';

import {
  UseSidekickSelectionOptions,
  UseSidekickSelectionReturn,
  UseAvailableSidekicksReturn,
  UseRecommendationsReturn
} from '../interfaces/sidekick-client';

import { getDefaultSidekickClient } from '../sdk/sidekick-client';

/**
 * Main hook for sidekick selection management
 */
export function useSidekickSelection(
  options: UseSidekickSelectionOptions = {}
): UseSidekickSelectionReturn {
  const {
    autoFetch = true,
    cacheTime = 300000, // 5 minutes
    refetchOnWindowFocus = true,
    onError
  } = options;

  // State
  const [currentSidekick, setCurrentSidekick] = useState<SidekickPersona | null>(null);
  const [currentSelection, setCurrentSelection] = useState<UserSidekickSelection | null>(null);
  const [availableSidekicks, setAvailableSidekicks] = useState<SidekickPersona[]>([]);
  const [recommendations, setRecommendations] = useState<SidekickPersona[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = getDefaultSidekickClient();
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Error handler
  const handleError = useCallback((err: Error) => {
    if (!isMountedRef.current) return;

    setError(err);
    onError?.(err);
  }, [onError]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch current selection
  const fetchCurrentSelection = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      const selection = await client.getCurrentSelection();

      if (!isMountedRef.current) return;

      setCurrentSelection(selection);

      // Fetch current sidekick details if selection exists
      if (selection?.selectedSidekickId) {
        try {
          const sidekick = await client.getSidekickById(selection.selectedSidekickId);
          if (isMountedRef.current) {
            setCurrentSidekick(sidekick);
          }
        } catch (err) {
          // Sidekick might have been deleted, keep selection but no sidekick details
          console.warn('Could not fetch current sidekick details:', err);
        }
      } else {
        setCurrentSidekick(null);
      }
    } catch (err) {
      handleError(err as Error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, handleError]);

  // Fetch available sidekicks
  const fetchAvailableSidekicks = useCallback(async (tier?: SubscriptionTier) => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      const sidekicks = await client.getAvailableSidekicks(tier);

      if (isMountedRef.current) {
        setAvailableSidekicks(sidekicks);
      }
    } catch (err) {
      handleError(err as Error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, handleError]);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async (context?: Partial<SidekickSelectionContext>) => {
    if (!isMountedRef.current) return;

    try {
      const recs = await client.getRecommendedSidekicks(context);

      if (isMountedRef.current) {
        setRecommendations(recs);
      }
    } catch (err) {
      handleError(err as Error);
    }
  }, [client, handleError]);

  // Select sidekick
  const selectSidekick = useCallback(async (
    sidekickId: string,
    preferences?: SidekickPreferences
  ) => {
    if (!isMountedRef.current) return;

    const defaultPreferences: SidekickPreferences = {
      notifications: true,
      voiceEnabled: false,
      realtimeUpdates: true,
      analysisDepth: 'basic',
      communicationStyle: 'casual',
      updateFrequency: 'hourly',
      ...preferences
    };

    try {
      setIsLoading(true);
      setError(null);

      const selection = await client.selectSidekick(sidekickId, defaultPreferences);

      if (!isMountedRef.current) return;

      setCurrentSelection(selection);

      // Fetch the selected sidekick details
      try {
        const sidekick = await client.getSidekickById(sidekickId);
        if (isMountedRef.current) {
          setCurrentSidekick(sidekick);
        }
      } catch (err) {
        console.warn('Could not fetch selected sidekick details:', err);
      }

      // Refresh available sidekicks to update any changes
      await fetchAvailableSidekicks();
    } catch (err) {
      handleError(err as Error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, handleError, fetchAvailableSidekicks]);

  // Update preferences
  const updatePreferences = useCallback(async (preferences: Partial<SidekickPreferences>) => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      await client.updatePreferences(preferences);

      // Refresh current selection to get updated preferences
      await fetchCurrentSelection();
    } catch (err) {
      handleError(err as Error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, handleError, fetchCurrentSelection]);

  // Refresh all sidekick data
  const refreshSidekicks = useCallback(async () => {
    await Promise.all([
      fetchCurrentSelection(),
      fetchAvailableSidekicks(),
      fetchRecommendations()
    ]);
  }, [fetchCurrentSelection, fetchAvailableSidekicks, fetchRecommendations]);

  // Initial data fetch
  useEffect(() => {
    if (autoFetch) {
      refreshSidekicks();
    }
  }, [autoFetch, refreshSidekicks]);

  // Window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (!document.hidden) {
        refreshSidekicks();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [refetchOnWindowFocus, refreshSidekicks]);

  // Computed values
  const hasActiveSelection = currentSelection?.isActive === true;
  const canSelectPremium = true; // This should be based on user subscription
  const canSelectPro = true; // This should be based on user subscription

  return {
    // Current state
    currentSidekick,
    currentSelection,
    isLoading,
    error,

    // Available sidekicks
    availableSidekicks,
    recommendations,

    // Actions
    selectSidekick,
    updatePreferences,
    refreshSidekicks,
    clearError,

    // Status flags
    hasActiveSelection,
    canSelectPremium,
    canSelectPro
  };
}

/**
 * Hook specifically for available sidekicks
 */
export function useAvailableSidekicks(tier?: SubscriptionTier): UseAvailableSidekicksReturn {
  const [sidekicks, setSidekicks] = useState<SidekickPersona[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = getDefaultSidekickClient();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await client.getAvailableSidekicks(tier);

      if (isMountedRef.current) {
        setSidekicks(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, tier]);

  const filterBySport = useCallback((sport: string) => {
    return sidekicks.filter(sidekick => sidekick.sports.includes(sport as any));
  }, [sidekicks]);

  const filterByTier = useCallback((targetTier: SubscriptionTier) => {
    const tierOrder = { free: 0, premium: 1, pro: 2 };
    const maxTier = tierOrder[targetTier];

    return sidekicks.filter(sidekick => tierOrder[sidekick.pricing.tier] <= maxTier);
  }, [sidekicks]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    sidekicks,
    isLoading,
    error,
    refetch,
    filterBySport,
    filterByTier
  };
}

/**
 * Hook specifically for recommendations
 */
export function useRecommendations(
  context?: Partial<SidekickSelectionContext>
): UseRecommendationsReturn {
  const [recommendations, setRecommendations] = useState<SidekickPersona[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = getDefaultSidekickClient();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await client.getRecommendedSidekicks(context);

      if (isMountedRef.current) {
        setRecommendations(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, context]);

  const acceptRecommendation = useCallback(async (sidekickId: string) => {
    const { selectSidekick } = useSidekickSelection();
    await selectSidekick(sidekickId);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    recommendations,
    isLoading,
    error,
    refresh,
    acceptRecommendation
  };
}

/**
 * Hook for sidekick selection history
 */
export function useSidekickHistory(limit: number = 10) {
  const [history, setHistory] = useState<UserSidekickSelection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = getDefaultSidekickClient();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await client.getSelectionHistory(limit);

      if (isMountedRef.current) {
        setHistory(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [client, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory
  };
}
