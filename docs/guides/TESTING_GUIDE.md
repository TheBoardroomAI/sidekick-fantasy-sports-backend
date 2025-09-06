# Testing Guide - Sidekick Selection System

## Overview

This guide covers testing strategies for both the backend API and frontend integration of the Sidekick Selection System.

## Backend Testing

### Cloud Functions Testing

```typescript
// __tests__/sidekickSelectionManager.test.ts
import { sidekickSelectionManager } from '../src/services/sidekickSelectionManager';
import * as admin from 'firebase-admin';

// Mock Firestore
const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn()
};

jest.mock('firebase-admin', () => ({
  firestore: () => mockFirestore,
  firestore: {
    Timestamp: {
      now: () => new Date(),
      fromDate: (date: Date) => date
    }
  }
}));

describe('SidekickSelectionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAvailableSidekicks returns active sidekicks for free tier', async () => {
    const mockSidekicks = [
      {
        id: 'sidekick1',
        name: 'Alex Analytics',
        pricing: { tier: 'free', monthlyPrice: 0 },
        isActive: true
      }
    ];

    mockFirestore.collection.mockReturnValue({
      where: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            forEach: (callback: Function) => {
              mockSidekicks.forEach(sidekick => {
                callback({ id: sidekick.id, data: () => sidekick });
              });
            }
          })
        })
      })
    });

    const result = await sidekickSelectionManager.getAvailableSidekicks('user123', 'free');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alex Analytics');
  });

  test('selectSidekick creates new selection and deactivates old ones', async () => {
    const mockSidekick = {
      id: 'sidekick1',
      name: 'Alex Analytics',
      isActive: true,
      pricing: { tier: 'free' }
    };

    const mockUser = {
      subscription: { tier: 'free' }
    };

    // Mock sidekick doc
    mockFirestore.collection.mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockSidekick
        })
      })
    });

    const result = await sidekickSelectionManager.selectSidekick(
      'user123',
      'sidekick1',
      {
        notifications: true,
        voiceEnabled: false,
        realtimeUpdates: true,
        analysisDepth: 'basic',
        communicationStyle: 'casual',
        updateFrequency: 'hourly'
      }
    );

    expect(result.userId).toBe('user123');
    expect(result.selectedSidekickId).toBe('sidekick1');
    expect(result.isActive).toBe(true);
  });
});
```

### API Route Testing

```typescript
// __tests__/routes/sidekick.test.ts
import request from 'supertest';
import express from 'express';
import sidekickRoutes from '../../src/routes/sidekick';

const app = express();
app.use(express.json());
app.use('/api/sidekicks', sidekickRoutes);

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    req.user = { uid: 'test-user-123' };
    next();
  }
}));

describe('Sidekick Routes', () => {
  test('GET /available returns available sidekicks', async () => {
    const response = await request(app)
      .get('/api/sidekicks/available')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.sidekicks)).toBe(true);
  });

  test('POST /select creates sidekick selection', async () => {
    const selectionData = {
      sidekickId: 'sidekick1',
      preferences: {
        notifications: true,
        voiceEnabled: false,
        realtimeUpdates: true,
        analysisDepth: 'basic',
        communicationStyle: 'casual',
        updateFrequency: 'hourly'
      }
    };

    const response = await request(app)
      .post('/api/sidekicks/select')
      .send(selectionData)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.selection).toBeDefined();
  });

  test('POST /select validates required fields', async () => {
    const response = await request(app)
      .post('/api/sidekicks/select')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.details).toContain('sidekickId is required');
  });
});
```

### Firestore Security Rules Testing

```typescript
// __tests__/firestore.rules.test.ts
import { 
  assertFails, 
  assertSucceeds, 
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test('allows authenticated users to read sidekicks', async () => {
    const db = testEnv.authenticatedContext('user123').firestore();

    await assertSucceeds(
      db.collection('sidekicks').doc('sidekick1').get()
    );
  });

  test('prevents unauthenticated users from reading sidekicks', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      db.collection('sidekicks').doc('sidekick1').get()
    );
  });

  test('allows users to read their own selections', async () => {
    const db = testEnv.authenticatedContext('user123').firestore();

    await assertSucceeds(
      db.collection('userSidekickSelections')
        .where('userId', '==', 'user123')
        .get()
    );
  });

  test('prevents users from reading other users selections', async () => {
    const db = testEnv.authenticatedContext('user123').firestore();

    await assertFails(
      db.collection('userSidekickSelections')
        .where('userId', '==', 'user456')
        .get()
    );
  });

  test('allows users to create selections for themselves', async () => {
    const db = testEnv.authenticatedContext('user123').firestore();

    await assertSucceeds(
      db.collection('userSidekickSelections').add({
        userId: 'user123',
        selectedSidekickId: 'sidekick1',
        selectionDate: new Date(),
        isActive: true,
        preferences: {
          notifications: true,
          voiceEnabled: false,
          realtimeUpdates: true
        },
        subscriptionTier: 'free'
      })
    );
  });
});
```

## Frontend Testing

### Hook Testing

```typescript
// __tests__/hooks/useSidekickSelection.test.ts
import { renderHook, act } from '@testing-library/react';
import { useSidekickSelection } from '../../src/hooks/useSidekickSelection';
import { SidekickClient } from '../../src/sdk/sidekick-client';

// Mock the SDK client
const mockClient = {
  getAvailableSidekicks: jest.fn(),
  getRecommendedSidekicks: jest.fn(),
  selectSidekick: jest.fn(),
  getCurrentSelection: jest.fn(),
  updatePreferences: jest.fn(),
  getSelectionHistory: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

jest.mock('../../src/sdk/sidekick-client', () => ({
  getDefaultSidekickClient: () => mockClient
}));

describe('useSidekickSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches available sidekicks on mount', async () => {
    const mockSidekicks = [
      { id: '1', name: 'Test Sidekick 1' },
      { id: '2', name: 'Test Sidekick 2' }
    ];

    mockClient.getAvailableSidekicks.mockResolvedValue(mockSidekicks);
    mockClient.getCurrentSelection.mockResolvedValue(null);
    mockClient.getRecommendedSidekicks.mockResolvedValue([]);

    const { result, waitForNextUpdate } = renderHook(() => 
      useSidekickSelection({ autoFetch: true })
    );

    expect(result.current.isLoading).toBe(true);

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.availableSidekicks).toEqual(mockSidekicks);
    expect(mockClient.getAvailableSidekicks).toHaveBeenCalledWith('free');
  });

  test('selects sidekick and updates state', async () => {
    const mockSelection = {
      id: 'selection1',
      userId: 'user123',
      selectedSidekickId: 'sidekick1',
      isActive: true
    };

    mockClient.selectSidekick.mockResolvedValue(mockSelection);
    mockClient.getSidekickById.mockResolvedValue({
      id: 'sidekick1',
      name: 'Test Sidekick'
    });

    const { result } = renderHook(() => useSidekickSelection({ autoFetch: false }));

    await act(async () => {
      await result.current.selectSidekick('sidekick1');
    });

    expect(result.current.currentSelection).toEqual(mockSelection);
    expect(mockClient.selectSidekick).toHaveBeenCalledWith(
      'sidekick1',
      expect.objectContaining({
        notifications: true,
        voiceEnabled: false,
        realtimeUpdates: true
      })
    );
  });

  test('handles errors gracefully', async () => {
    const error = new Error('Network error');
    mockClient.getAvailableSidekicks.mockRejectedValue(error);

    const onError = jest.fn();
    const { result, waitForNextUpdate } = renderHook(() => 
      useSidekickSelection({ onError })
    );

    await waitForNextUpdate();

    expect(result.current.error).toEqual(error);
    expect(onError).toHaveBeenCalledWith(error);
  });
});
```

### Component Testing

```typescript
// __tests__/components/SidekickCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SidekickCard } from '../../src/components/SidekickCard';

const mockSidekick = {
  id: 'sidekick1',
  name: 'Alex Analytics',
  description: 'Data-driven fantasy sports analyst',
  expertise: ['Statistics', 'Analysis'],
  tone: 'analytical' as const,
  sports: ['NFL', 'NBA'],
  isActive: true,
  features: {
    voice: true,
    realtime: true,
    analysis: true,
    recommendations: true
  },
  pricing: {
    tier: 'free' as const,
    monthlyPrice: 0
  }
};

describe('SidekickCard', () => {
  test('renders sidekick information correctly', () => {
    render(<SidekickCard sidekick={mockSidekick} />);

    expect(screen.getByText('Alex Analytics')).toBeInTheDocument();
    expect(screen.getByText('Data-driven fantasy sports analyst')).toBeInTheDocument();
    expect(screen.getByText('NFL, NBA')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  test('shows premium pricing for paid sidekicks', () => {
    const premiumSidekick = {
      ...mockSidekick,
      pricing: { tier: 'premium' as const, monthlyPrice: 9.99 }
    };

    render(<SidekickCard sidekick={premiumSidekick} />);

    expect(screen.getByText('$9.99/month')).toBeInTheDocument();
  });

  test('calls onSelect when select button is clicked', () => {
    const onSelect = jest.fn();

    render(<SidekickCard sidekick={mockSidekick} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Select'));

    expect(onSelect).toHaveBeenCalledWith('sidekick1');
  });

  test('shows selected state correctly', () => {
    render(<SidekickCard sidekick={mockSidekick} isSelected={true} />);

    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('Selected')).toBeDisabled();
  });

  test('shows recommended badge when isRecommended is true', () => {
    render(<SidekickCard sidekick={mockSidekick} isRecommended={true} />);

    expect(screen.getByText(/recommended/i)).toBeInTheDocument();
  });

  test('disables button when disabled prop is true', () => {
    render(<SidekickCard sidekick={mockSidekick} disabled={true} />);

    expect(screen.getByText('Select')).toBeDisabled();
  });
});
```

### SDK Client Testing

```typescript
// __tests__/sdk/sidekick-client.test.ts
import { SidekickClient } from '../../src/sdk/sidekick-client';

// Mock fetch
global.fetch = jest.fn();

describe('SidekickClient', () => {
  let client: SidekickClient;

  beforeEach(() => {
    client = new SidekickClient({
      apiBaseUrl: 'https://test-api.com',
      authToken: 'test-token'
    });

    (fetch as jest.Mock).mockClear();
  });

  test('getAvailableSidekicks makes correct API call', async () => {
    const mockResponse = {
      success: true,
      data: {
        sidekicks: [{ id: '1', name: 'Test Sidekick' }]
      }
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await client.getAvailableSidekicks('premium');

    expect(fetch).toHaveBeenCalledWith(
      'https://test-api.com/api/sidekicks/available?tier=premium',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        })
      })
    );

    expect(result).toEqual([{ id: '1', name: 'Test Sidekick' }]);
  });

  test('selectSidekick makes POST request with correct data', async () => {
    const mockSelection = {
      id: 'selection1',
      userId: 'user123',
      selectedSidekickId: 'sidekick1'
    };

    const mockResponse = {
      success: true,
      data: { selection: mockSelection }
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const preferences = {
      notifications: true,
      voiceEnabled: false,
      realtimeUpdates: true,
      analysisDepth: 'basic' as const,
      communicationStyle: 'casual' as const,
      updateFrequency: 'hourly' as const
    };

    const result = await client.selectSidekick('sidekick1', preferences);

    expect(fetch).toHaveBeenCalledWith(
      'https://test-api.com/api/sidekicks/select',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sidekickId: 'sidekick1',
          preferences
        })
      })
    );

    expect(result).toEqual(mockSelection);
  });

  test('handles API errors correctly', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({
        success: false,
        error: 'Sidekick not found'
      })
    });

    await expect(client.getSidekickById('nonexistent'))
      .rejects
      .toThrow('Sidekick not found');
  });

  test('retries failed requests', async () => {
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { sidekicks: [] }
        })
      });

    await client.getAvailableSidekicks();

    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
```

## Integration Testing

### End-to-End Testing with Cypress

```typescript
// cypress/integration/sidekick-selection.spec.ts
describe('Sidekick Selection Flow', () => {
  beforeEach(() => {
    // Mock authentication
    cy.login('test@example.com', 'password');
    cy.visit('/sidekicks');
  });

  it('displays available sidekicks', () => {
    cy.get('[data-testid="sidekick-card"]').should('have.length.at.least', 1);
    cy.get('[data-testid="sidekick-name"]').first().should('be.visible');
  });

  it('allows user to select a sidekick', () => {
    cy.get('[data-testid="select-sidekick-btn"]').first().click();

    // Should show preferences form
    cy.get('[data-testid="preferences-form"]').should('be.visible');

    // Fill out preferences
    cy.get('[data-testid="notifications-checkbox"]').check();
    cy.get('[data-testid="analysis-depth-select"]').select('detailed');

    // Submit
    cy.get('[data-testid="save-preferences-btn"]').click();

    // Should show success message
    cy.get('[data-testid="success-message"]').should('contain', 'Sidekick selected');
  });

  it('shows recommendations for user', () => {
    cy.get('[data-testid="recommendations-section"]').should('be.visible');
    cy.get('[data-testid="recommended-sidekick"]').should('have.length.at.least', 1);
  });

  it('filters sidekicks by sport', () => {
    const initialCount = cy.get('[data-testid="sidekick-card"]').length;

    cy.get('[data-testid="sport-filter"]').select('NFL');

    cy.get('[data-testid="sidekick-card"]').should('have.length.lte', initialCount);
  });
});
```

### API Integration Testing

```typescript
// __tests__/integration/api.test.ts
import axios from 'axios';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:5001';

describe('Sidekick API Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get test authentication token
    authToken = await getTestAuthToken();
  });

  test('complete sidekick selection flow', async () => {
    // 1. Get available sidekicks
    const availableResponse = await axios.get(
      `${API_BASE_URL}/api/sidekicks/available`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    expect(availableResponse.status).toBe(200);
    expect(availableResponse.data.success).toBe(true);
    expect(availableResponse.data.data.sidekicks.length).toBeGreaterThan(0);

    const sidekickId = availableResponse.data.data.sidekicks[0].id;

    // 2. Select a sidekick
    const selectionResponse = await axios.post(
      `${API_BASE_URL}/api/sidekicks/select`,
      {
        sidekickId,
        preferences: {
          notifications: true,
          voiceEnabled: false,
          realtimeUpdates: true,
          analysisDepth: 'basic',
          communicationStyle: 'casual',
          updateFrequency: 'hourly'
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    expect(selectionResponse.status).toBe(200);
    expect(selectionResponse.data.success).toBe(true);
    expect(selectionResponse.data.data.selection.selectedSidekickId).toBe(sidekickId);

    // 3. Get current selection
    const currentResponse = await axios.get(
      `${API_BASE_URL}/api/sidekicks/current`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    expect(currentResponse.status).toBe(200);
    expect(currentResponse.data.data.selection.selectedSidekickId).toBe(sidekickId);

    // 4. Update preferences
    const updateResponse = await axios.put(
      `${API_BASE_URL}/api/sidekicks/preferences`,
      {
        preferences: {
          analysisDepth: 'detailed',
          notifications: false
        }
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.success).toBe(true);
  });
});
```

## Performance Testing

### Load Testing with Artillery

```yaml
# artillery-config.yml
config:
  target: 'https://your-api.com'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 10
      name: "Sustained load"

scenarios:
  - name: "Sidekick Selection Flow"
    beforeRequest: "setAuthToken"
    flow:
      - get:
          url: "/api/sidekicks/available"
      - post:
          url: "/api/sidekicks/select"
          json:
            sidekickId: "{{ $randomString() }}"
            preferences:
              notifications: true
              voiceEnabled: false
              realtimeUpdates: true
      - get:
          url: "/api/sidekicks/current"
```

### Frontend Performance Testing

```typescript
// __tests__/performance/sidekick-performance.test.ts
import { render } from '@testing-library/react';
import { SidekickSelector } from '../../src/components/SidekickSelector';

describe('SidekickSelector Performance', () => {
  test('renders 1000 sidekicks without performance issues', () => {
    const largeSidekickList = Array.from({ length: 1000 }, (_, i) => ({
      id: `sidekick${i}`,
      name: `Sidekick ${i}`,
      description: `Description ${i}`,
      // ... other properties
    }));

    const startTime = performance.now();

    render(<SidekickSelector sidekicks={largeSidekickList} />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in under 100ms
    expect(renderTime).toBeLessThan(100);
  });
});
```

## Test Utilities

### Test Helpers

```typescript
// __tests__/utils/test-helpers.ts
import { SidekickPersona, UserSidekickSelection } from '../../src/types/sidekick';

export const createMockSidekick = (overrides?: Partial<SidekickPersona>): SidekickPersona => ({
  id: 'mock-sidekick-1',
  name: 'Mock Sidekick',
  description: 'A test sidekick',
  expertise: ['Testing'],
  tone: 'analytical',
  sports: ['NFL'],
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
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockSelection = (overrides?: Partial<UserSidekickSelection>): UserSidekickSelection => ({
  id: 'mock-selection-1',
  userId: 'mock-user-1',
  selectedSidekickId: 'mock-sidekick-1',
  selectionDate: new Date(),
  isActive: true,
  preferences: {
    notifications: true,
    voiceEnabled: false,
    realtimeUpdates: true,
    analysisDepth: 'basic',
    communicationStyle: 'casual',
    updateFrequency: 'hourly'
  },
  subscriptionTier: 'free',
  ...overrides
});

export const mockSidekickClient = {
  getAvailableSidekicks: jest.fn(),
  getRecommendedSidekicks: jest.fn(),
  selectSidekick: jest.fn(),
  getCurrentSelection: jest.fn(),
  updatePreferences: jest.fn(),
  getSelectionHistory: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};
```

### Custom Render Function

```typescript
// __tests__/utils/test-render.tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SidekickProvider } from '../../src/providers/SidekickProvider';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SidekickProvider>
        {children}
      </SidekickProvider>
    </QueryClientProvider>
  );
};

const customRender = (ui: React.ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Sidekick Selection System

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd functions
          npm install

      - name: Run backend tests
        run: |
          cd functions
          npm test

      - name: Run security rules tests
        run: |
          cd functions
          npm run test:rules

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run frontend tests
        run: npm test

      - name: Run E2E tests
        run: npm run test:e2e

  deploy-test:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to test environment
        run: ./deployment/deploy.sh test
```

---

*This testing guide ensures comprehensive coverage of the Sidekick Selection System. For deployment instructions, see [Deployment Guide](../DEPLOYMENT_GUIDE.md).*
