# Sidekick Selection System - Integration Guide

## Overview

This guide provides complete instructions for integrating the Sidekick Selection System into your React/TypeScript frontend application. The system allows users to select and customize AI sidekicks for fantasy sports advice.

## Table of Contents

1. [Quick Start](#quick-start)
2. [SDK Installation](#sdk-installation)
3. [Authentication Setup](#authentication-setup)
4. [Basic Integration](#basic-integration)
5. [React Hooks Usage](#react-hooks-usage)
6. [Component Examples](#component-examples)
7. [Error Handling](#error-handling)
8. [Advanced Features](#advanced-features)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Install Dependencies

```bash
npm install @theboardroom/sidekick-sdk
# or
yarn add @theboardroom/sidekick-sdk
```

### 2. Initialize SDK

```typescript
// app.tsx or main.tsx
import { initializeSidekickClient } from '@theboardroom/sidekick-sdk';

// Initialize the client
initializeSidekickClient({
  apiBaseUrl: 'https://us-central1-your-project.cloudfunctions.net',
  enableCaching: true,
  enableAnalytics: true
});
```

### 3. Use React Hooks

```typescript
import { useSidekickSelection } from '@theboardroom/sidekick-sdk';

function SidekickSelector() {
  const {
    availableSidekicks,
    currentSelection,
    selectSidekick,
    isLoading,
    error
  } = useSidekickSelection();

  return (
    <div>
      {availableSidekicks.map(sidekick => (
        <button
          key={sidekick.id}
          onClick={() => selectSidekick(sidekick.id)}
          disabled={isLoading}
        >
          {sidekick.name}
        </button>
      ))}
    </div>
  );
}
```

## SDK Installation

### Option 1: Copy SDK Files to Your Project

Copy the following files from this repository to your project:

```
your-project/
├── src/
│   ├── types/
│   │   └── sidekick.ts           # From src/types/sidekick.ts
│   ├── interfaces/
│   │   └── sidekick-client.ts    # From src/interfaces/sidekick-client.ts
│   ├── sdk/
│   │   └── sidekick-client.ts    # From src/sdk/sidekick-client.ts
│   └── hooks/
│       └── useSidekickSelection.ts # From src/hooks/useSidekickSelection.ts
```

### Option 2: NPM Package (Future)

When available as an npm package:

```bash
npm install @theboardroom/sidekick-sdk
```

## Authentication Setup

### Firebase Authentication Integration

```typescript
// auth-context.tsx
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';
import { auth } from '../config/firebase';

export function useAuthEffect() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const client = getDefaultSidekickClient();

      if (user) {
        // Get the user's ID token
        const token = await user.getIdToken();
        client.setAuthToken(token);
      } else {
        client.clearAuthToken();
      }
    });

    return unsubscribe;
  }, []);
}
```

### Custom Authentication

```typescript
// For custom auth systems
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

function setUserToken(token: string) {
  const client = getDefaultSidekickClient();
  client.setAuthToken(token);
}
```

## Basic Integration

### 1. Client Configuration

```typescript
// config/sidekick.ts
import { initializeSidekickClient } from '../sdk/sidekick-client';

export const sidekickConfig = {
  apiBaseUrl: process.env.REACT_APP_API_BASE_URL || 'https://us-central1-your-project.cloudfunctions.net',
  timeout: 10000,
  retryAttempts: 3,
  enableCaching: true,
  cacheTimeout: 300000, // 5 minutes
  enableAnalytics: true
};

// Initialize the client
export const sidekickClient = initializeSidekickClient(sidekickConfig);
```

### 2. Provider Setup (Optional)

```typescript
// components/SidekickProvider.tsx
import React, { createContext, useContext } from 'react';
import { SidekickClient } from '../sdk/sidekick-client';

const SidekickContext = createContext<SidekickClient | null>(null);

export function SidekickProvider({ 
  children, 
  client 
}: { 
  children: React.ReactNode;
  client: SidekickClient;
}) {
  return (
    <SidekickContext.Provider value={client}>
      {children}
    </SidekickContext.Provider>
  );
}

export function useSidekickClient() {
  const context = useContext(SidekickContext);
  if (!context) {
    throw new Error('useSidekickClient must be used within SidekickProvider');
  }
  return context;
}
```

## React Hooks Usage

### Primary Hook: useSidekickSelection

```typescript
import { useSidekickSelection } from '../hooks/useSidekickSelection';

function SidekickDashboard() {
  const {
    // Current state
    currentSidekick,
    currentSelection,
    availableSidekicks,
    recommendations,
    isLoading,
    error,

    // Actions
    selectSidekick,
    updatePreferences,
    refreshSidekicks,
    clearError,

    // Status
    hasActiveSelection,
    canSelectPremium,
    canSelectPro
  } = useSidekickSelection({
    autoFetch: true,
    refetchOnWindowFocus: true,
    onError: (error) => console.error('Sidekick error:', error)
  });

  if (isLoading) return <div>Loading sidekicks...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Available Sidekicks</h2>
      {availableSidekicks.map(sidekick => (
        <SidekickCard
          key={sidekick.id}
          sidekick={sidekick}
          isSelected={currentSelection?.selectedSidekickId === sidekick.id}
          onSelect={() => selectSidekick(sidekick.id)}
        />
      ))}
    </div>
  );
}
```

### Specialized Hooks

#### Available Sidekicks Hook

```typescript
import { useAvailableSidekicks } from '../hooks/useSidekickSelection';

function SidekickBrowser() {
  const { sidekicks, isLoading, error, refetch, filterBySport, filterByTier } = useAvailableSidekicks('premium');

  const nflSidekicks = filterBySport('NFL');
  const freeSidekicks = filterByTier('free');

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      <div>NFL Sidekicks: {nflSidekicks.length}</div>
      <div>Free Sidekicks: {freeSidekicks.length}</div>
    </div>
  );
}
```

#### Recommendations Hook

```typescript
import { useRecommendations } from '../hooks/useSidekickSelection';

function SidekickRecommendations() {
  const { 
    recommendations, 
    isLoading, 
    error, 
    refresh, 
    acceptRecommendation 
  } = useRecommendations({
    preferredSports: ['NFL', 'NBA'],
    currentSubscription: { tier: 'premium' }
  });

  return (
    <div>
      <h3>Recommended for You</h3>
      {recommendations.map(sidekick => (
        <div key={sidekick.id}>
          <h4>{sidekick.name}</h4>
          <button onClick={() => acceptRecommendation(sidekick.id)}>
            Select This Sidekick
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Component Examples

### Complete Sidekick Selector Component

```typescript
// components/SidekickSelector.tsx
import React, { useState } from 'react';
import { useSidekickSelection } from '../hooks/useSidekickSelection';
import { SidekickPersona, SidekickPreferences } from '../types/sidekick';

interface SidekickSelectorProps {
  onSelectionChange?: (selection: any) => void;
  showRecommendations?: boolean;
  maxDisplayCount?: number;
}

export function SidekickSelector({ 
  onSelectionChange, 
  showRecommendations = true,
  maxDisplayCount = 10 
}: SidekickSelectorProps) {
  const [selectedSport, setSelectedSport] = useState<string>('');

  const {
    availableSidekicks,
    recommendations,
    currentSelection,
    selectSidekick,
    isLoading,
    error,
    clearError
  } = useSidekickSelection();

  const handleSelectSidekick = async (sidekickId: string) => {
    const defaultPreferences: SidekickPreferences = {
      notifications: true,
      voiceEnabled: false,
      realtimeUpdates: true,
      analysisDepth: 'basic',
      communicationStyle: 'casual',
      updateFrequency: 'hourly'
    };

    try {
      const selection = await selectSidekick(sidekickId, defaultPreferences);
      onSelectionChange?.(selection);
    } catch (err) {
      console.error('Failed to select sidekick:', err);
    }
  };

  const filteredSidekicks = selectedSport 
    ? availableSidekicks.filter(s => s.sports.includes(selectedSport as any))
    : availableSidekicks;

  const displaySidekicks = filteredSidekicks.slice(0, maxDisplayCount);

  if (error) {
    return (
      <div className="error-container">
        <p>Error loading sidekicks: {error.message}</p>
        <button onClick={clearError}>Retry</button>
      </div>
    );
  }

  return (
    <div className="sidekick-selector">
      <div className="controls">
        <select 
          value={selectedSport} 
          onChange={(e) => setSelectedSport(e.target.value)}
        >
          <option value="">All Sports</option>
          <option value="NFL">NFL</option>
          <option value="NBA">NBA</option>
          <option value="MLB">MLB</option>
          <option value="NHL">NHL</option>
        </select>
      </div>

      {showRecommendations && recommendations.length > 0 && (
        <div className="recommendations">
          <h3>Recommended for You</h3>
          {recommendations.map(sidekick => (
            <SidekickCard
              key={sidekick.id}
              sidekick={sidekick}
              isRecommended={true}
              onSelect={() => handleSelectSidekick(sidekick.id)}
              disabled={isLoading}
            />
          ))}
        </div>
      )}

      <div className="available-sidekicks">
        <h3>Available Sidekicks</h3>
        {displaySidekicks.map(sidekick => (
          <SidekickCard
            key={sidekick.id}
            sidekick={sidekick}
            isSelected={currentSelection?.selectedSidekickId === sidekick.id}
            onSelect={() => handleSelectSidekick(sidekick.id)}
            disabled={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
```

### Sidekick Card Component

```typescript
// components/SidekickCard.tsx
import React from 'react';
import { SidekickPersona } from '../types/sidekick';

interface SidekickCardProps {
  sidekick: SidekickPersona;
  isSelected?: boolean;
  isRecommended?: boolean;
  onSelect?: (sidekickId: string) => void;
  disabled?: boolean;
}

export function SidekickCard({ 
  sidekick, 
  isSelected, 
  isRecommended, 
  onSelect, 
  disabled 
}: SidekickCardProps) {
  return (
    <div className={`sidekick-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}>
      {sidekick.avatar && (
        <img src={sidekick.avatar} alt={sidekick.name} className="avatar" />
      )}

      <div className="content">
        <h4>{sidekick.name}</h4>
        <p className="description">{sidekick.description}</p>

        <div className="details">
          <div className="tone">Tone: {sidekick.tone}</div>
          <div className="sports">Sports: {sidekick.sports.join(', ')}</div>
          <div className="pricing">
            {sidekick.pricing.tier === 'free' ? 'Free' : `$${sidekick.pricing.monthlyPrice}/month`}
          </div>
        </div>

        <div className="features">
          {sidekick.features.voice && <span className="feature">🎤 Voice</span>}
          {sidekick.features.realtime && <span className="feature">⚡ Real-time</span>}
          {sidekick.features.analysis && <span className="feature">📊 Analysis</span>}
        </div>
      </div>

      <button
        onClick={() => onSelect?.(sidekick.id)}
        disabled={disabled}
        className={`select-button ${isSelected ? 'selected' : ''}`}
      >
        {isSelected ? 'Selected' : 'Select'}
      </button>
    </div>
  );
}
```

### Preferences Component

```typescript
// components/SidekickPreferences.tsx
import React, { useState } from 'react';
import { useSidekickSelection } from '../hooks/useSidekickSelection';
import { SidekickPreferences } from '../types/sidekick';

export function SidekickPreferencesForm() {
  const { currentSelection, updatePreferences, isLoading } = useSidekickSelection();
  const [preferences, setPreferences] = useState<SidekickPreferences>(
    currentSelection?.preferences || {
      notifications: true,
      voiceEnabled: false,
      realtimeUpdates: true,
      analysisDepth: 'basic',
      communicationStyle: 'casual',
      updateFrequency: 'hourly'
    }
  );

  const handleSave = async () => {
    try {
      await updatePreferences(preferences);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  };

  if (!currentSelection) {
    return <div>Please select a sidekick first.</div>;
  }

  return (
    <div className="preferences-form">
      <h3>Sidekick Preferences</h3>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={preferences.notifications}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev, 
              notifications: e.target.checked 
            }))}
          />
          Enable Notifications
        </label>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={preferences.voiceEnabled}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev, 
              voiceEnabled: e.target.checked 
            }))}
          />
          Enable Voice Features
        </label>
      </div>

      <div className="form-group">
        <label>
          Analysis Depth:
          <select
            value={preferences.analysisDepth}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev, 
              analysisDepth: e.target.value as any 
            }))}
          >
            <option value="basic">Basic</option>
            <option value="detailed">Detailed</option>
            <option value="comprehensive">Comprehensive</option>
          </select>
        </label>
      </div>

      <button onClick={handleSave} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
```

## Error Handling

### Global Error Handler

```typescript
// hooks/useErrorHandler.ts
import { useEffect } from 'react';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

export function useGlobalErrorHandler() {
  useEffect(() => {
    const client = getDefaultSidekickClient();

    const handleError = (error: Error) => {
      console.error('Sidekick SDK Error:', error);

      // Handle specific error types
      if (error.name === 'SidekickError') {
        // Handle API errors
        if (error.message.includes('authentication')) {
          // Redirect to login
          window.location.href = '/login';
        }
      }
    };

    const handleNetworkError = (error: Error) => {
      // Show offline banner or retry mechanism
      console.warn('Network error, app may be offline:', error);
    };

    const handleAuthError = (error: Error) => {
      // Clear user session and redirect to login
      console.error('Authentication error:', error);
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    };

    client.addEventListener('error', handleError);
    client.addEventListener('network_error', handleNetworkError);
    client.addEventListener('auth_error', handleAuthError);

    return () => {
      client.removeEventListener('error', handleError);
      client.removeEventListener('network_error', handleNetworkError);
      client.removeEventListener('auth_error', handleAuthError);
    };
  }, []);
}
```

### Component-Level Error Handling

```typescript
// components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SidekickErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Sidekick component error:', error, errorInfo);

    // Report to error tracking service
    // analytics.track('sidekick_error', { error: error.message, ...errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h3>Something went wrong with the sidekick system</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Advanced Features

### Caching Strategy

```typescript
// utils/cache.ts
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

export function configureCaching() {
  const client = getDefaultSidekickClient();

  client.configure({
    enableCaching: true,
    cacheTimeout: 300000, // 5 minutes for sidekick data
  });

  // Listen for cache updates
  client.addEventListener('cache_updated', (data) => {
    console.log('Cache updated:', data.key, data.count);
  });
}
```

### Analytics Integration

```typescript
// utils/analytics.ts
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

export function setupAnalytics() {
  const client = getDefaultSidekickClient();

  // Track sidekick selections
  client.addEventListener('selection_changed', (selection) => {
    // Send to your analytics service
    analytics.track('sidekick_selected', {
      sidekickId: selection.selectedSidekickId,
      subscriptionTier: selection.subscriptionTier
    });
  });

  // Track preferences updates
  client.addEventListener('preferences_updated', (preferences) => {
    analytics.track('sidekick_preferences_updated', preferences);
  });
}
```

## Best Practices

### 1. Performance Optimization

```typescript
// Use React.memo for components that render many sidekicks
export const SidekickCard = React.memo(({ sidekick, ...props }) => {
  // Component implementation
});

// Debounce search/filter operations
import { useMemo } from 'react';
import { debounce } from 'lodash';

function SidekickSearch() {
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      // Perform search
    }, 300),
    []
  );

  return (
    <input onChange={(e) => debouncedSearch(e.target.value)} />
  );
}
```

### 2. Loading States

```typescript
function SidekickSelector() {
  const { isLoading, availableSidekicks } = useSidekickSelection();

  if (isLoading && availableSidekicks.length === 0) {
    return <SidekickSkeletonLoader />;
  }

  return (
    <div>
      {isLoading && <div className="loading-overlay">Updating...</div>}
      {/* Render sidekicks */}
    </div>
  );
}
```

### 3. Accessibility

```typescript
// Ensure proper ARIA labels and keyboard navigation
function SidekickCard({ sidekick, onSelect }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select ${sidekick.name} sidekick`}
      onClick={() => onSelect(sidekick.id)}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(sidekick.id);
        }
      }}
    >
      {/* Card content */}
    </div>
  );
}
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```
Error: Authentication required
```
**Solution**: Ensure the user is logged in and the auth token is properly set:

```typescript
const client = getDefaultSidekickClient();
const token = await user.getIdToken();
client.setAuthToken(token);
```

#### 2. Network Timeouts
```
Error: Request timeout
```
**Solution**: Increase timeout or implement retry logic:

```typescript
client.configure({
  timeout: 15000, // 15 seconds
  retryAttempts: 5
});
```

#### 3. Cache Issues
```
Stale data being displayed
```
**Solution**: Clear cache or disable caching for real-time data:

```typescript
const { refreshSidekicks } = useSidekickSelection();
await refreshSidekicks(); // Force refresh
```

### Debug Mode

```typescript
// Enable debug logging
localStorage.setItem('sidekick_debug', 'true');

// The SDK will log detailed information to console
```

## Support

For issues or questions:
1. Check the [API Reference](./API_REFERENCE.md)
2. Review the [Database Schema](./DATABASE_SCHEMA.md)
3. See [Testing Guide](./TESTING_GUIDE.md)
4. Open an issue on GitHub

## Next Steps

After completing this integration:
1. Test with different user subscription tiers
2. Implement custom sidekick features
3. Add analytics tracking
4. Set up error monitoring
5. Optimize for performance

---

*This integration guide is part of the Sidekick Fantasy Sports Backend system. For backend documentation, see the main README.md file.*
