# Sidekick Selection API Documentation

## PreferredName Feature Overview

The PreferredName feature allows users to personalize their sidekick interaction by providing a custom name that the sidekick will use to address them. This enhances the personal connection and user experience.

## New API Endpoints

### 1. Select Sidekick with Preferred Name

**Endpoint:** `POST /api/sidekicks/select-with-name`

**Description:** Select a sidekick and provide a preferred name for personalized interactions.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "sidekickId": "string",
  "preferredName": "string",
  "preferences": {
    "notifications": boolean,
    "voiceEnabled": boolean,
    "realtimeUpdates": boolean
  }
}
```

**Validation Rules:**
- `sidekickId`: Required, non-empty string
- `preferredName`: Required, 1-50 characters, alphanumeric + spaces, hyphens, apostrophes only
- `preferences`: Optional object with boolean fields

**Response:**
```json
{
  "success": true,
  "data": {
    "selection": {
      "userId": "string",
      "selectedSidekickId": "string",
      "selectionDate": "timestamp",
      "isActive": true,
      "preferences": {
        "notifications": boolean,
        "voiceEnabled": boolean,
        "realtimeUpdates": boolean
      },
      "subscriptionTier": "free|premium|pro",
      "preferredName": "string"
    },
    "message": "string"
  }
}
```

**Error Responses:**
- `400`: Invalid request data (validation errors)
- `401`: Authentication required
- `403`: Sidekick not available for subscription tier
- `500`: Internal server error

---

### 2. Update Preferred Name

**Endpoint:** `PUT /api/sidekicks/preferred-name`

**Description:** Update the preferred name for the current sidekick selection.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "preferredName": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "preferredName": "string",
    "message": "Preferred name updated successfully"
  }
}
```

**Error Responses:**
- `400`: Invalid preferred name
- `401`: Authentication required
- `404`: No active sidekick selection
- `500`: Internal server error

---

### 3. Get Current Selection with Preferred Name

**Endpoint:** `GET /api/sidekicks/current`

**Description:** Retrieve the user's current sidekick selection including preferred name.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "data": {
    "hasSelection": boolean,
    "currentSidekick": {
      "id": "string",
      "name": "string",
      "description": "string",
      "expertise": ["string"],
      "tone": "professional|casual|analytical|motivational",
      "sports": ["string"],
      "isActive": boolean,
      "features": {
        "voice": boolean,
        "realtime": boolean,
        "analysis": boolean,
        "recommendations": boolean
      },
      "pricing": {
        "tier": "free|premium|pro",
        "monthlyPrice": number
      },
      "avatar": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    },
    "selectionData": {
      "userId": "string",
      "selectedSidekickId": "string",
      "selectionDate": "timestamp",
      "isActive": boolean,
      "preferences": {
        "notifications": boolean,
        "voiceEnabled": boolean,
        "realtimeUpdates": boolean
      },
      "subscriptionTier": "free|premium|pro",
      "preferredName": "string"
    }
  }
}
```

## Modified Endpoints

### Legacy Sidekick Selection (Backward Compatible)

**Endpoint:** `POST /api/sidekicks/select`

**Changes:** 
- Now internally uses `selectSidekickWithName` with user's `displayName` or "User" as default
- Maintains full backward compatibility
- Adds `preferredName` field to response

**Request Body:** (Unchanged)
```json
{
  "sidekickId": "string",
  "preferences": {
    "notifications": boolean,
    "voiceEnabled": boolean,
    "realtimeUpdates": boolean
  }
}
```

**Response:** (Enhanced with preferredName)
```json
{
  "success": true,
  "data": {
    "selection": {
      "userId": "string",
      "selectedSidekickId": "string",
      "selectionDate": "timestamp",
      "isActive": boolean,
      "preferences": {
        "notifications": boolean,
        "voiceEnabled": boolean,
        "realtimeUpdates": boolean
      },
      "subscriptionTier": "free|premium|pro",
      "preferredName": "string"  // NEW: Added preferred name
    },
    "message": "string"
  }
}
```

## Frontend SDK Updates

### New Methods

#### `selectSidekickWithName(selectionData)`
```typescript
interface SidekickSelectionWithName {
  sidekickId: string;
  preferredName: string;
  preferences?: SidekickPreferences;
}

await client.selectSidekickWithName({
  sidekickId: 'coach-mike',
  preferredName: 'Alex',
  preferences: {
    notifications: true,
    voiceEnabled: true,
    realtimeUpdates: false
  }
});
```

#### `updatePreferredName(preferredName)`
```typescript
await client.updatePreferredName('Alexandra');
```

#### `getCurrentSelection()`
```typescript
const selection = await client.getCurrentSelection();
if (selection.hasSelection) {
  console.log(`Your sidekick will call you: ${selection.selectionData.preferredName}`);
}
```

#### `validatePreferredName(preferredName)`
```typescript
const validation = client.validatePreferredName('Alex Smith');
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
} else {
  console.log('Sanitized name:', validation.sanitizedName);
}
```

### New Events

#### `preferred_name_updated`
```typescript
client.on('preferred_name_updated', (data) => {
  console.log(`Preferred name updated to: ${data.preferredName}`);
});
```

## Usage Examples

### Frontend Flow Example

```typescript
import { SidekickClient } from './sdk/sidekick-client';

const client = new SidekickClient({
  baseURL: 'https://api.yourapp.com',
  authToken: userToken
});

// 1. Show sidekick selection modal
const sidekicks = await client.getAvailableSidekicks('premium');

// 2. User selects sidekick and enters preferred name
const selectedSidekick = sidekicks[0];
const preferredName = 'Coach'; // From user input

// 3. Validate preferred name
const validation = client.validatePreferredName(preferredName);
if (!validation.isValid) {
  showErrors(validation.errors);
  return;
}

// 4. Select sidekick with preferred name
try {
  const selection = await client.selectSidekickWithName({
    sidekickId: selectedSidekick.id,
    preferredName: validation.sanitizedName,
    preferences: {
      notifications: true,
      voiceEnabled: true,
      realtimeUpdates: true
    }
  });

  showSuccess(`${selectedSidekick.name} will now call you ${selection.preferredName}!`);
} catch (error) {
  showError('Failed to select sidekick: ' + error.message);
}

// 5. Later, user can update their preferred name
await client.updatePreferredName('Alex');
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { SidekickClient } from '../sdk/sidekick-client';

export function useSidekickSelection() {
  const [currentSelection, setCurrentSelection] = useState(null);
  const [loading, setLoading] = useState(false);

  const client = new SidekickClient({ /* config */ });

  const selectWithName = async (sidekickId: string, preferredName: string) => {
    setLoading(true);
    try {
      const selection = await client.selectSidekickWithName({
        sidekickId,
        preferredName
      });
      setCurrentSelection(selection);
      return selection;
    } finally {
      setLoading(false);
    }
  };

  const updatePreferredName = async (preferredName: string) => {
    await client.updatePreferredName(preferredName);
    // Refresh current selection
    const updated = await client.getCurrentSelection();
    setCurrentSelection(updated.selectionData);
  };

  useEffect(() => {
    // Load current selection on mount
    client.getCurrentSelection().then(result => {
      setCurrentSelection(result.selectionData);
    });

    // Listen for updates
    client.on('preferred_name_updated', (data) => {
      setCurrentSelection(prev => prev ? {...prev, preferredName: data.preferredName} : null);
    });
  }, []);

  return {
    currentSelection,
    loading,
    selectWithName,
    updatePreferredName,
    validateName: client.validatePreferredName.bind(client)
  };
}
```

## Database Schema Changes

### Users Collection
```json
{
  "preferences": {
    "favoriteTeams": ["string"],
    "notifications": boolean,
    "voiceEnabled": boolean,
    "selectedPersona": "string",
    "preferredName": "string"  // NEW: User's preferred name
  }
}
```

### UserSidekickSelections Collection
```json
{
  "userId": "string",
  "selectedSidekickId": "string",
  "selectionDate": "timestamp",
  "isActive": boolean,
  "preferences": {
    "notifications": boolean,
    "voiceEnabled": boolean,
    "realtimeUpdates": boolean
  },
  "subscriptionTier": "string",
  "preferredName": "string"  // NEW: Preferred name for this selection
}
```

## Migration Guide

### 1. Database Migration
Run the migration script to add preferredName fields to existing documents:
```bash
node migrations/add-preferred-name-support.js
```

### 2. Frontend Updates
Update your frontend to use the new SDK methods:

```typescript
// Old way
await client.selectSidekick(sidekickId, preferences);

// New way (with preferred name)
await client.selectSidekickWithName({
  sidekickId,
  preferredName: 'YourName',
  preferences
});
```

### 3. Backward Compatibility
The existing `/api/sidekicks/select` endpoint remains fully functional and will:
- Use the user's `displayName` as the preferred name
- Fall back to "User" if no display name exists
- Include the `preferredName` field in responses

### 4. Error Handling
Handle new validation errors for preferred names:

```typescript
try {
  await client.selectSidekickWithName(data);
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Show validation errors to user
    showValidationErrors(error.message);
  } else {
    // Handle other errors
    showGenericError(error.message);
  }
}
```

## Rate Limiting

All endpoints maintain existing rate limits:
- `GET` endpoints: 20-30 requests per minute
- `POST/PUT` endpoints: 10-20 requests per minute
- `DELETE` endpoints: 5 requests per minute

## Security Considerations

1. **Input Validation**: All preferred names are validated and sanitized
2. **Authentication**: All endpoints require valid authentication
3. **Authorization**: Users can only update their own preferred names
4. **Data Sanitization**: Names are automatically capitalized and cleaned
5. **Length Limits**: Names are restricted to 1-50 characters to prevent abuse
