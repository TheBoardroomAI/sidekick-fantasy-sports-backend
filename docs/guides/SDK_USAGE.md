# Frontend SDK Usage Guide - Sidekick Selection System

## Overview

This guide provides detailed instructions for using the Sidekick Selection Frontend SDK, including React hooks, TypeScript SDK, and component integration patterns.

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [React Hooks Reference](#react-hooks-reference)
4. [SDK Client Reference](#sdk-client-reference)
5. [Component Patterns](#component-patterns)
6. [State Management](#state-management)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Performance Optimization](#performance-optimization)
10. [Advanced Usage](#advanced-usage)

## Installation

### Copy SDK Files

Copy the following files to your React TypeScript project:

```
your-project/src/
├── types/sidekick.ts               # Type definitions
├── interfaces/sidekick-client.ts   # Client interfaces  
├── sdk/sidekick-client.ts          # Main SDK client
└── hooks/useSidekickSelection.ts   # React hooks
```

### Initialize SDK

```typescript
// app.tsx
import { initializeSidekickClient } from './sdk/sidekick-client';

// Initialize on app startup
initializeSidekickClient({
  apiBaseUrl: process.env.REACT_APP_API_BASE_URL!,
  enableCaching: true,
  enableAnalytics: true,
  timeout: 10000,
  retryAttempts: 3
});
```

## Basic Setup

### 1. Provider Pattern (Recommended)

```typescript
// providers/SidekickProvider.tsx
import React, { createContext, useContext } from 'react';
import { getDefaultSidekickClient, SidekickClient } from '../sdk/sidekick-client';

const SidekickContext = createContext<SidekickClient | null>(null);

export function SidekickProvider({ children }: { children: React.ReactNode }) {
  const client = getDefaultSidekickClient();

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

### 2. App Integration

```typescript
// App.tsx
import { SidekickProvider } from './providers/SidekickProvider';
import { AuthProvider } from './providers/AuthProvider';

function App() {
  return (
    <AuthProvider>
      <SidekickProvider>
        <Router>
          {/* Your app components */}
        </Router>
      </SidekickProvider>
    </AuthProvider>
  );
}
```

## React Hooks Reference

### useSidekickSelection

Primary hook for managing sidekick selection state.

#### API

```typescript
const {
  // Current State
  currentSidekick,        // SidekickPersona | null
  currentSelection,       // UserSidekickSelection | null
  availableSidekicks,     // SidekickPersona[]
  recommendations,        // SidekickPersona[]
  isLoading,              // boolean
  error,                  // Error | null

  // Actions
  selectSidekick,         // (id: string, prefs?: SidekickPreferences) => Promise<void>
  updatePreferences,      // (prefs: Partial<SidekickPreferences>) => Promise<void>
  refreshSidekicks,       // () => Promise<void>
  clearError,             // () => void

  // Status
  hasActiveSelection,     // boolean
  canSelectPremium,       // boolean
  canSelectPro            // boolean
} = useSidekickSelection(options);
```

#### Options

```typescript
interface UseSidekickSelectionOptions {
  autoFetch?: boolean;              // Auto-fetch on mount (default: true)
  cacheTime?: number;              // Cache duration in ms (default: 300000)
  refetchOnWindowFocus?: boolean;  // Refetch on focus (default: true)
  onError?: (error: Error) => void; // Error callback
}
```

#### Example Usage

```typescript
function SidekickDashboard() {
  const {
    availableSidekicks,
    currentSelection,
    selectSidekick,
    updatePreferences,
    isLoading,
    error
  } = useSidekickSelection({
    onError: (error) => toast.error(error.message)
  });

  const handleSelectSidekick = async (sidekickId: string) => {
    await selectSidekick(sidekickId, {
      notifications: true,
      voiceEnabled: false,
      realtimeUpdates: true,
      analysisDepth: 'basic',
      communicationStyle: 'casual',
      updateFrequency: 'hourly'
    });
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {availableSidekicks.map(sidekick => (
        <SidekickCard
          key={sidekick.id}
          sidekick={sidekick}
          isSelected={currentSelection?.selectedSidekickId === sidekick.id}
          onSelect={() => handleSelectSidekick(sidekick.id)}
        />
      ))}
    </div>
  );
}
```

### useAvailableSidekicks

Hook for fetching and filtering available sidekicks.

#### API

```typescript
const {
  sidekicks,           // SidekickPersona[]
  isLoading,           // boolean
  error,               // Error | null
  refetch,             // () => Promise<void>
  filterBySport,       // (sport: string) => SidekickPersona[]
  filterByTier         // (tier: SubscriptionTier) => SidekickPersona[]
} = useAvailableSidekicks(tier);
```

#### Example Usage

```typescript
function SidekickBrowser() {
  const { sidekicks, filterBySport, filterByTier } = useAvailableSidekicks('premium');
  const [selectedSport, setSelectedSport] = useState('');

  const filteredSidekicks = selectedSport 
    ? filterBySport(selectedSport)
    : sidekicks;

  return (
    <div>
      <select onChange={(e) => setSelectedSport(e.target.value)}>
        <option value="">All Sports</option>
        <option value="NFL">NFL</option>
        <option value="NBA">NBA</option>
        <option value="MLB">MLB</option>
      </select>

      {filteredSidekicks.map(sidekick => (
        <SidekickCard key={sidekick.id} sidekick={sidekick} />
      ))}
    </div>
  );
}
```

### useRecommendations

Hook for fetching personalized sidekick recommendations.

#### API

```typescript
const {
  recommendations,      // SidekickPersona[]
  isLoading,           // boolean
  error,               // Error | null
  refresh,             // () => Promise<void>
  acceptRecommendation // (sidekickId: string) => Promise<void>
} = useRecommendations(context);
```

#### Example Usage

```typescript
function RecommendationWidget() {
  const { recommendations, acceptRecommendation } = useRecommendations({
    preferredSports: ['NFL', 'NBA'],
    currentSubscription: { tier: 'premium' }
  });

  return (
    <div className="recommendations">
      <h3>Recommended for You</h3>
      {recommendations.map(sidekick => (
        <div key={sidekick.id} className="recommendation-card">
          <h4>{sidekick.name}</h4>
          <p>{sidekick.description}</p>
          <button onClick={() => acceptRecommendation(sidekick.id)}>
            Select This Sidekick
          </button>
        </div>
      ))}
    </div>
  );
}
```

### useSidekickHistory

Hook for accessing user's sidekick selection history.

#### API

```typescript
const {
  history,    // UserSidekickSelection[]
  isLoading,  // boolean
  error,      // Error | null
  refetch     // () => Promise<void>
} = useSidekickHistory(limit);
```

#### Example Usage

```typescript
function SelectionHistory() {
  const { history, isLoading } = useSidekickHistory(20);

  if (isLoading) return <div>Loading history...</div>;

  return (
    <div>
      <h3>Selection History</h3>
      {history.map(selection => (
        <div key={selection.id}>
          <div>Selected: {selection.selectionDate}</div>
          <div>Active: {selection.isActive ? 'Yes' : 'No'}</div>
        </div>
      ))}
    </div>
  );
}
```

## SDK Client Reference

### SidekickClient Class

Direct SDK client for advanced usage scenarios.

#### Constructor

```typescript
import { SidekickClient } from './sdk/sidekick-client';

const client = new SidekickClient({
  apiBaseUrl: 'https://your-api.com',
  authToken: 'firebase-token',
  timeout: 10000,
  retryAttempts: 3,
  enableCaching: true,
  enableAnalytics: true
});
```

#### Methods

```typescript
// Authentication
client.setAuthToken(token: string): void
client.clearAuthToken(): void

// Sidekick Management
client.getAvailableSidekicks(tier?: SubscriptionTier): Promise<SidekickPersona[]>
client.getRecommendedSidekicks(context?: Partial<SidekickSelectionContext>): Promise<SidekickPersona[]>
client.getSidekickById(id: string): Promise<SidekickPersona>

// Selection Management
client.selectSidekick(sidekickId: string, preferences: SidekickPreferences): Promise<UserSidekickSelection>
client.getCurrentSelection(): Promise<UserSidekickSelection | null>
client.updatePreferences(preferences: Partial<SidekickPreferences>): Promise<void>
client.getSelectionHistory(limit?: number): Promise<UserSidekickSelection[]>

// Events
client.addEventListener(event: SidekickClientEvent, handler: SidekickEventHandler): void
client.removeEventListener(event: SidekickClientEvent, handler: SidekickEventHandler): void
```

#### Example Usage

```typescript
import { getDefaultSidekickClient } from './sdk/sidekick-client';

async function selectSidekickProgrammatically() {
  const client = getDefaultSidekickClient();

  // Get available sidekicks
  const sidekicks = await client.getAvailableSidekicks('premium');

  // Select first available
  if (sidekicks.length > 0) {
    const selection = await client.selectSidekick(sidekicks[0].id, {
      notifications: true,
      voiceEnabled: false,
      realtimeUpdates: true,
      analysisDepth: 'basic',
      communicationStyle: 'casual',
      updateFrequency: 'hourly'
    });

    console.log('Selected:', selection);
  }
}
```

## Component Patterns

### Basic Sidekick Selector

```typescript
interface SidekickSelectorProps {
  onSelectionChange?: (selection: UserSidekickSelection) => void;
  showRecommendations?: boolean;
  className?: string;
}

function SidekickSelector({ onSelectionChange, showRecommendations = true }: SidekickSelectorProps) {
  const { availableSidekicks, recommendations, selectSidekick, isLoading } = useSidekickSelection();

  const handleSelect = async (sidekickId: string) => {
    const selection = await selectSidekick(sidekickId);
    onSelectionChange?.(selection);
  };

  return (
    <div className="sidekick-selector">
      {showRecommendations && recommendations.length > 0 && (
        <RecommendationSection recommendations={recommendations} onSelect={handleSelect} />
      )}

      <div className="available-sidekicks">
        {availableSidekicks.map(sidekick => (
          <SidekickCard
            key={sidekick.id}
            sidekick={sidekick}
            onSelect={() => handleSelect(sidekick.id)}
            disabled={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
```

### Preferences Form

```typescript
function SidekickPreferencesForm() {
  const { currentSelection, updatePreferences, isLoading } = useSidekickSelection();
  const [preferences, setPreferences] = useState(currentSelection?.preferences);

  useEffect(() => {
    setPreferences(currentSelection?.preferences);
  }, [currentSelection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preferences) {
      await updatePreferences(preferences);
    }
  };

  if (!currentSelection) return <div>Select a sidekick first</div>;

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          <input
            type="checkbox"
            checked={preferences?.notifications}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev!, 
              notifications: e.target.checked 
            }))}
          />
          Notifications
        </label>
      </div>

      <div>
        <label>
          Analysis Depth:
          <select
            value={preferences?.analysisDepth}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev!, 
              analysisDepth: e.target.value as any 
            }))}
          >
            <option value="basic">Basic</option>
            <option value="detailed">Detailed</option>
            <option value="comprehensive">Comprehensive</option>
          </select>
        </label>
      </div>

      <button type="submit" disabled={isLoading}>
        Save Preferences
      </button>
    </form>
  );
}
```

## State Management

### With Redux Toolkit

```typescript
// store/sidekickSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

export const fetchAvailableSidekicks = createAsyncThunk(
  'sidekicks/fetchAvailable',
  async (tier: SubscriptionTier) => {
    const client = getDefaultSidekickClient();
    return await client.getAvailableSidekicks(tier);
  }
);

const sidekickSlice = createSlice({
  name: 'sidekicks',
  initialState: {
    available: [],
    current: null,
    loading: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAvailableSidekicks.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAvailableSidekicks.fulfilled, (state, action) => {
        state.loading = false;
        state.available = action.payload;
      })
      .addCase(fetchAvailableSidekicks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export default sidekickSlice.reducer;
```

### With Zustand

```typescript
// store/sidekickStore.ts
import { create } from 'zustand';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

interface SidekickStore {
  sidekicks: SidekickPersona[];
  currentSelection: UserSidekickSelection | null;
  isLoading: boolean;
  error: string | null;

  fetchSidekicks: (tier?: SubscriptionTier) => Promise<void>;
  selectSidekick: (id: string, prefs: SidekickPreferences) => Promise<void>;
  clearError: () => void;
}

export const useSidekickStore = create<SidekickStore>((set, get) => ({
  sidekicks: [],
  currentSelection: null,
  isLoading: false,
  error: null,

  fetchSidekicks: async (tier = 'free') => {
    set({ isLoading: true, error: null });
    try {
      const client = getDefaultSidekickClient();
      const sidekicks = await client.getAvailableSidekicks(tier);
      set({ sidekicks, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  selectSidekick: async (id, prefs) => {
    set({ isLoading: true, error: null });
    try {
      const client = getDefaultSidekickClient();
      const selection = await client.selectSidekick(id, prefs);
      set({ currentSelection: selection, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null })
}));
```

## Error Handling

### Custom Error Hook

```typescript
// hooks/useErrorHandler.ts
import { useCallback } from 'react';
import { toast } from 'react-toastify';

export function useErrorHandler() {
  return useCallback((error: Error, context?: string) => {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);

    // Show user-friendly message
    const message = error.name === 'SidekickError' 
      ? error.message 
      : 'An unexpected error occurred';

    toast.error(message);

    // Report to error tracking service
    // analytics.track('error', { message: error.message, context });
  }, []);
}
```

### Error Boundary

```typescript
// components/SidekickErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('Sidekick Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h3>Sidekick System Error</h3>
          <p>Something went wrong with the sidekick system.</p>
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

## Testing

### Testing Hooks

```typescript
// __tests__/useSidekickSelection.test.ts
import { renderHook, act } from '@testing-library/react';
import { useSidekickSelection } from '../hooks/useSidekickSelection';

// Mock the SDK client
jest.mock('../sdk/sidekick-client', () => ({
  getDefaultSidekickClient: () => ({
    getAvailableSidekicks: jest.fn().mockResolvedValue([
      { id: '1', name: 'Test Sidekick' }
    ]),
    selectSidekick: jest.fn().mockResolvedValue({
      id: 'selection1',
      selectedSidekickId: '1'
    })
  })
}));

test('should fetch available sidekicks on mount', async () => {
  const { result, waitForNextUpdate } = renderHook(() => 
    useSidekickSelection({ autoFetch: true })
  );

  expect(result.current.isLoading).toBe(true);

  await waitForNextUpdate();

  expect(result.current.isLoading).toBe(false);
  expect(result.current.availableSidekicks).toHaveLength(1);
});

test('should select sidekick', async () => {
  const { result, waitForNextUpdate } = renderHook(() => 
    useSidekickSelection()
  );

  await act(async () => {
    await result.current.selectSidekick('1');
  });

  expect(result.current.currentSelection?.selectedSidekickId).toBe('1');
});
```

### Testing Components

```typescript
// __tests__/SidekickSelector.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SidekickSelector } from '../components/SidekickSelector';

// Mock the hook
jest.mock('../hooks/useSidekickSelection', () => ({
  useSidekickSelection: () => ({
    availableSidekicks: [
      { id: '1', name: 'Test Sidekick', description: 'Test description' }
    ],
    selectSidekick: jest.fn(),
    isLoading: false,
    error: null
  })
}));

test('renders available sidekicks', () => {
  render(<SidekickSelector />);

  expect(screen.getByText('Test Sidekick')).toBeInTheDocument();
  expect(screen.getByText('Test description')).toBeInTheDocument();
});

test('calls selectSidekick when sidekick is clicked', async () => {
  const mockSelect = jest.fn();

  render(<SidekickSelector />);

  const selectButton = screen.getByText('Select');
  fireEvent.click(selectButton);

  await waitFor(() => {
    expect(mockSelect).toHaveBeenCalledWith('1');
  });
});
```

## Performance Optimization

### Memoization

```typescript
// Memoize expensive computations
const MemoizedSidekickCard = React.memo(SidekickCard, (prevProps, nextProps) => {
  return prevProps.sidekick.id === nextProps.sidekick.id &&
         prevProps.isSelected === nextProps.isSelected;
});

// Memoize filtered results
function SidekickList({ sidekicks, filters }) {
  const filteredSidekicks = useMemo(() => {
    return sidekicks.filter(sidekick => {
      return filters.sports.length === 0 || 
             sidekick.sports.some(sport => filters.sports.includes(sport));
    });
  }, [sidekicks, filters]);

  return (
    <div>
      {filteredSidekicks.map(sidekick => (
        <MemoizedSidekickCard key={sidekick.id} sidekick={sidekick} />
      ))}
    </div>
  );
}
```

### Virtual Scrolling

```typescript
// For large lists of sidekicks
import { FixedSizeList as List } from 'react-window';

function VirtualSidekickList({ sidekicks }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <SidekickCard sidekick={sidekicks[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={sidekicks.length}
      itemSize={200}
    >
      {Row}
    </List>
  );
}
```

### Debounced Search

```typescript
import { useDebouncedCallback } from 'use-debounce';

function SidekickSearch({ onSearch }) {
  const debouncedSearch = useDebouncedCallback(
    (query: string) => onSearch(query),
    300
  );

  return (
    <input
      type="text"
      placeholder="Search sidekicks..."
      onChange={(e) => debouncedSearch(e.target.value)}
    />
  );
}
```

## Advanced Usage

### Custom Event Listeners

```typescript
// Listen for SDK events
useEffect(() => {
  const client = getDefaultSidekickClient();

  const handleSelectionChange = (selection) => {
    console.log('Selection changed:', selection);
    // Update analytics, show notifications, etc.
  };

  const handleError = (error) => {
    console.error('SDK Error:', error);
    // Handle error appropriately
  };

  client.addEventListener('selection_changed', handleSelectionChange);
  client.addEventListener('error', handleError);

  return () => {
    client.removeEventListener('selection_changed', handleSelectionChange);
    client.removeEventListener('error', handleError);
  };
}, []);
```

### Custom Cache Strategy

```typescript
// Custom caching with React Query
import { useQuery, useQueryClient } from 'react-query';

function useCustomSidekicks() {
  const queryClient = useQueryClient();

  return useQuery(
    'sidekicks',
    () => getDefaultSidekickClient().getAvailableSidekicks(),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      onSuccess: (data) => {
        // Pre-populate individual sidekick queries
        data.forEach(sidekick => {
          queryClient.setQueryData(['sidekick', sidekick.id], sidekick);
        });
      }
    }
  );
}
```

### Offline Support

```typescript
// Offline-first approach
import { useNetworkState } from 'react-use';

function OfflineSidekickSelector() {
  const { online } = useNetworkState();
  const { availableSidekicks, isLoading, error } = useSidekickSelection();

  if (!online) {
    return <div>Offline mode - showing cached sidekicks</div>;
  }

  return <SidekickSelector />;
}
```

---

*This SDK usage guide provides comprehensive integration patterns for the Sidekick Selection System. For API details, see [API Reference](../api/API_REFERENCE.md).*
