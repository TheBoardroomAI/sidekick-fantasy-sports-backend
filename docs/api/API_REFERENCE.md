# Sidekick Selection API Reference

## Overview

Complete API reference for the Sidekick Selection System. All endpoints require authentication unless otherwise specified.

**Base URL**: `https://us-central1-your-project.cloudfunctions.net/api`

## Authentication

All API requests require a valid Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## Rate Limits

- Available sidekicks: 30 requests/minute
- Recommendations: 20 requests/minute
- Selection operations: 10 requests/minute
- Preferences updates: 30 requests/minute
- History: 20 requests/minute

## Endpoints

### GET /sidekicks/available

Get all available sidekicks for the authenticated user based on their subscription tier.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tier` | string | No | `free` | Subscription tier (`free`, `premium`, `pro`) |

#### Response

```json
{
  "success": true,
  "data": {
    "sidekicks": [
      {
        "id": "sidekick_001",
        "name": "Alex Analytics",
        "description": "Your data-driven fantasy sports analyst specializing in statistical insights and trend analysis.",
        "expertise": ["Statistics", "Trend Analysis", "Player Performance", "Matchup Analysis"],
        "tone": "analytical",
        "sports": ["NFL", "NBA", "MLB", "NHL"],
        "isActive": true,
        "features": {
          "voice": true,
          "realtime": true,
          "analysis": true,
          "recommendations": true
        },
        "pricing": {
          "tier": "free",
          "monthlyPrice": 0
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 3,
    "subscriptionTier": "free"
  }
}
```

#### Example Request

```bash
curl -X GET \
  "https://us-central1-your-project.cloudfunctions.net/api/sidekicks/available?tier=premium" \
  -H "Authorization: Bearer <firebase-id-token>"
```

### GET /sidekicks/recommended

Get personalized sidekick recommendations based on user profile and preferences.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sports` | string | No | Comma-separated list of preferred sports |

#### Response

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "sidekick_002",
        "name": "Coach Mike",
        "description": "A motivational fantasy coach who helps you stay positive and make confident decisions.",
        "expertise": ["Team Strategy", "Motivation", "Decision Making", "Risk Management"],
        "tone": "motivational",
        "sports": ["NFL", "NBA", "MLB"],
        "isActive": true,
        "features": {
          "voice": true,
          "realtime": false,
          "analysis": true,
          "recommendations": true
        },
        "pricing": {
          "tier": "premium",
          "monthlyPrice": 9.99
        }
      }
    ],
    "count": 1,
    "context": {
      "preferredSports": ["NFL"],
      "subscriptionTier": "free"
    }
  }
}
```

### POST /sidekicks/select

Select a sidekick for the authenticated user.

#### Request Body

```json
{
  "sidekickId": "sidekick_001",
  "preferences": {
    "notifications": true,
    "voiceEnabled": false,
    "realtimeUpdates": true,
    "analysisDepth": "basic",
    "communicationStyle": "casual",
    "updateFrequency": "hourly"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "selection": {
      "id": "selection_123",
      "userId": "user_456",
      "selectedSidekickId": "sidekick_001",
      "selectionDate": "2024-01-01T12:00:00.000Z",
      "isActive": true,
      "preferences": {
        "notifications": true,
        "voiceEnabled": false,
        "realtimeUpdates": true,
        "analysisDepth": "basic",
        "communicationStyle": "casual",
        "updateFrequency": "hourly"
      },
      "subscriptionTier": "free"
    },
    "message": "Sidekick selected successfully"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 404 | `SIDEKICK_NOT_FOUND` | Sidekick does not exist |
| 410 | `SIDEKICK_NOT_AVAILABLE` | Sidekick is inactive |
| 403 | `INSUFFICIENT_SUBSCRIPTION` | User's tier cannot access this sidekick |

### GET /sidekicks/current

Get the user's current active sidekick selection.

#### Response

```json
{
  "success": true,
  "data": {
    "selection": {
      "id": "selection_123",
      "userId": "user_456",
      "selectedSidekickId": "sidekick_001",
      "selectionDate": "2024-01-01T12:00:00.000Z",
      "isActive": true,
      "preferences": {
        "notifications": true,
        "voiceEnabled": false,
        "realtimeUpdates": true,
        "analysisDepth": "basic",
        "communicationStyle": "casual",
        "updateFrequency": "hourly"
      },
      "subscriptionTier": "free"
    }
  }
}
```

#### No Active Selection

```json
{
  "success": true,
  "data": {
    "selection": null,
    "message": "No active sidekick selection found"
  }
}
```

### PUT /sidekicks/preferences

Update preferences for the current sidekick selection.

#### Request Body

```json
{
  "preferences": {
    "notifications": false,
    "analysisDepth": "detailed"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Preferences updated successfully",
    "preferences": {
      "notifications": false,
      "analysisDepth": "detailed"
    }
  }
}
```

### GET /sidekicks/history

Get the user's sidekick selection history.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 10 | Maximum number of selections to return (max: 50) |

#### Response

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "selection_123",
        "userId": "user_456",
        "selectedSidekickId": "sidekick_001",
        "selectionDate": "2024-01-01T12:00:00.000Z",
        "isActive": true,
        "preferences": {
          "notifications": true,
          "voiceEnabled": false,
          "realtimeUpdates": true
        },
        "subscriptionTier": "free"
      }
    ],
    "count": 1,
    "limit": 10
  }
}
```

### POST /sidekicks/initialize

Initialize default sidekicks in the database. **Admin only**.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Default sidekicks initialized successfully"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Admin privileges required"
}
```

## Cloud Functions (Direct Call)

### initializeDefaultSidekicks

Initialize default sidekicks. Admin only.

```javascript
const functions = firebase.functions();
const initSidekicks = functions.httpsCallable('initializeDefaultSidekicks');

try {
  const result = await initSidekicks();
  console.log(result.data);
} catch (error) {
  console.error('Error:', error);
}
```

### getAvailableSidekicks

Get available sidekicks for user.

```javascript
const getAvailable = functions.httpsCallable('getAvailableSidekicks');

try {
  const result = await getAvailable({ tier: 'premium' });
  console.log(result.data.sidekicks);
} catch (error) {
  console.error('Error:', error);
}
```

### selectSidekick

Select a sidekick for the user.

```javascript
const selectSidekick = functions.httpsCallable('selectSidekick');

try {
  const result = await selectSidekick({
    sidekickId: 'sidekick_001',
    preferences: {
      notifications: true,
      voiceEnabled: false,
      realtimeUpdates: true,
      analysisDepth: 'basic',
      communicationStyle: 'casual',
      updateFrequency: 'hourly'
    }
  });
  console.log(result.data.selection);
} catch (error) {
  console.error('Error:', error);
}
```

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description",
  "details": ["Validation error 1", "Validation error 2"]
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `INSUFFICIENT_SUBSCRIPTION` | 403 | User tier cannot access resource |
| `SIDEKICK_NOT_FOUND` | 404 | Sidekick does not exist |
| `SELECTION_NOT_FOUND` | 404 | No active selection found |
| `SIDEKICK_NOT_AVAILABLE` | 410 | Sidekick is inactive |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `QUOTA_EXCEEDED` | 429 | Rate limit exceeded |
| `SERVER_ERROR` | 500 | Internal server error |

## Data Types

### SidekickPersona

```typescript
interface SidekickPersona {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  tone: 'professional' | 'casual' | 'analytical' | 'motivational';
  sports: ('NFL' | 'NBA' | 'MLB' | 'NHL' | 'Soccer')[];
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
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

### UserSidekickSelection

```typescript
interface UserSidekickSelection {
  id: string;
  userId: string;
  selectedSidekickId: string;
  selectionDate: string; // ISO 8601 timestamp
  isActive: boolean;
  preferences: SidekickPreferences;
  subscriptionTier: 'free' | 'premium' | 'pro';
}
```

### SidekickPreferences

```typescript
interface SidekickPreferences {
  notifications: boolean;
  voiceEnabled: boolean;
  realtimeUpdates: boolean;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  communicationStyle: 'formal' | 'casual' | 'technical';
  updateFrequency: 'immediate' | 'hourly' | 'daily';
  preferredSports?: ('NFL' | 'NBA' | 'MLB' | 'NHL' | 'Soccer')[];
  timezone?: string;
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
// Using the SDK
import { SidekickClient } from '@theboardroom/sidekick-sdk';

const client = new SidekickClient({
  apiBaseUrl: 'https://us-central1-your-project.cloudfunctions.net',
  authToken: await user.getIdToken()
});

// Get available sidekicks
const sidekicks = await client.getAvailableSidekicks('premium');

// Select a sidekick
const selection = await client.selectSidekick('sidekick_001', {
  notifications: true,
  voiceEnabled: false,
  realtimeUpdates: true,
  analysisDepth: 'basic',
  communicationStyle: 'casual',
  updateFrequency: 'hourly'
});

// Update preferences
await client.updatePreferences({
  analysisDepth: 'detailed',
  notifications: false
});
```

### React Hooks

```tsx
import { useSidekickSelection } from '@theboardroom/sidekick-sdk';

function MyComponent() {
  const {
    availableSidekicks,
    currentSelection,
    selectSidekick,
    updatePreferences,
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

## Testing

### Example Test Requests

```bash
# Get available sidekicks
curl -X GET \
  "https://us-central1-your-project.cloudfunctions.net/api/sidekicks/available" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# Select a sidekick
curl -X POST \
  "https://us-central1-your-project.cloudfunctions.net/api/sidekicks/select" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sidekickId": "sidekick_001",
    "preferences": {
      "notifications": true,
      "voiceEnabled": false,
      "realtimeUpdates": true,
      "analysisDepth": "basic",
      "communicationStyle": "casual", 
      "updateFrequency": "hourly"
    }
  }'
```

### Postman Collection

Import the API collection for easy testing:

1. Download: [Sidekick API Postman Collection](./sidekick-api.postman_collection.json)
2. Import into Postman
3. Set environment variables:
   - `base_url`: Your API base URL
   - `auth_token`: Your Firebase ID token

## Rate Limiting

The API implements rate limiting per endpoint to ensure fair usage:

- **Available sidekicks**: 30 requests per minute
- **Recommendations**: 20 requests per minute  
- **Selection operations**: 10 requests per minute
- **Preferences updates**: 30 requests per minute
- **History**: 20 requests per minute
- **Admin operations**: 1 request per 5 minutes

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1640995200
```

## Webhooks (Future)

Future versions will support webhooks for real-time updates:

- `sidekick.selection.created`
- `sidekick.preferences.updated`
- `sidekick.recommendation.generated`

## Changelog

### v1.0.0 (2024-01-01)
- Initial release
- Basic CRUD operations for sidekick selection
- Recommendation engine
- Preference management
- History tracking

---

*For integration examples and guides, see the [Integration Guide](../guides/INTEGRATION_GUIDE.md).*
