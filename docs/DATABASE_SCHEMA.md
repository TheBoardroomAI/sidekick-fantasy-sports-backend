# Database Schema - Sidekick Selection System

## Overview

This document describes the Firestore database schema for the Sidekick Selection System.

## Collections

### `sidekicks` Collection

Stores all available sidekick personas.

```typescript
interface SidekickPersona {
  id: string;                    // Document ID
  name: string;                  // Display name
  description: string;           // Detailed description
  expertise: string[];           // Areas of expertise
  tone: 'professional' | 'casual' | 'analytical' | 'motivational';
  sports: ('NFL' | 'NBA' | 'MLB' | 'NHL' | 'Soccer')[];
  isActive: boolean;             // Whether sidekick is available
  features: {
    voice: boolean;              // Voice interaction support
    realtime: boolean;           // Real-time updates
    analysis: boolean;           // Statistical analysis
    recommendations: boolean;    // Personalized recommendations
  };
  pricing: {
    tier: 'free' | 'premium' | 'pro';
    monthlyPrice: number;
  };
  avatar?: string;               // Profile image URL
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Example Document

```json
{
  "id": "alex_analytics",
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
```

### `userSidekickSelections` Collection

Stores user sidekick selections and preferences.

```typescript
interface UserSidekickSelection {
  id: string;                    // Document ID
  userId: string;                // User's Firebase UID
  selectedSidekickId: string;    // Reference to sidekick
  selectionDate: Timestamp;      // When selection was made
  isActive: boolean;             // Whether this is the active selection
  preferences: {
    notifications: boolean;
    voiceEnabled: boolean;
    realtimeUpdates: boolean;
    analysisDepth: 'basic' | 'detailed' | 'comprehensive';
    communicationStyle: 'formal' | 'casual' | 'technical';
    updateFrequency: 'immediate' | 'hourly' | 'daily';
    preferredSports?: ('NFL' | 'NBA' | 'MLB' | 'NHL' | 'Soccer')[];
    timezone?: string;
  };
  subscriptionTier: 'free' | 'premium' | 'pro';
}
```

#### Example Document

```json
{
  "userId": "firebase_user_123",
  "selectedSidekickId": "alex_analytics",
  "selectionDate": "2024-01-15T10:30:00.000Z",
  "isActive": true,
  "preferences": {
    "notifications": true,
    "voiceEnabled": false,
    "realtimeUpdates": true,
    "analysisDepth": "basic",
    "communicationStyle": "casual",
    "updateFrequency": "hourly",
    "preferredSports": ["NFL", "NBA"],
    "timezone": "America/New_York"
  },
  "subscriptionTier": "free"
}
```

### `users` Collection (Enhanced)

Extended user profiles with sidekick-related fields.

```typescript
interface User {
  // Existing fields...
  currentSidekickId?: string;           // Current active sidekick
  lastSidekickSelection?: Timestamp;    // Last selection timestamp
  sidekickPreferences?: {
    autoRecommendations: boolean;
    preferredTones: ('professional' | 'casual' | 'analytical' | 'motivational')[];
    sports: ('NFL' | 'NBA' | 'MLB' | 'NHL' | 'Soccer')[];
  };
}
```

## Indexes

Required Firestore indexes for optimal query performance:

### `sidekicks` Collection Indexes

1. **Active sidekicks by tier**
   ```
   Collection: sidekicks
   Fields: isActive (Ascending), pricing.tier (Ascending), name (Ascending)
   ```

2. **Sidekicks by sport**
   ```
   Collection: sidekicks
   Fields: isActive (Ascending), sports (Array-contains), name (Ascending)
   ```

### `userSidekickSelections` Collection Indexes

1. **User's active selection**
   ```
   Collection: userSidekickSelections
   Fields: userId (Ascending), isActive (Ascending), selectionDate (Descending)
   ```

2. **User's selection history**
   ```
   Collection: userSidekickSelections
   Fields: userId (Ascending), selectionDate (Descending)
   ```

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sidekick Selection Rules
    match /sidekicks/{sidekickId} {
      // Allow all authenticated users to read sidekicks
      allow read: if request.auth != null;

      // Only admins can create, update, or delete sidekicks
      allow create, update, delete: if request.auth != null && 
        request.auth.token.admin == true;
    }

    match /userSidekickSelections/{selectionId} {
      // Users can only access their own selections
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;

      // Allow users to create new selections for themselves
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.userId &&
        validateSidekickSelection();
    }

    // Helper function to validate sidekick selection data
    function validateSidekickSelection() {
      let data = request.resource.data;
      return data.keys().hasAll(['userId', 'selectedSidekickId', 'selectionDate', 
                               'isActive', 'preferences', 'subscriptionTier']) &&
             data.userId is string &&
             data.selectedSidekickId is string &&
             data.selectionDate is timestamp &&
             data.isActive is bool &&
             data.preferences is map &&
             data.subscriptionTier in ['free', 'premium', 'pro'];
    }
  }
}
```

## Data Migration

### Initial Setup

1. **Create collections** (automatically created on first write)
2. **Deploy indexes** using `firebase deploy --only firestore:indexes`
3. **Deploy security rules** using `firebase deploy --only firestore:rules`
4. **Initialize default sidekicks** using the admin initialization endpoint

### Default Sidekicks

The system includes three default sidekicks:

1. **Alex Analytics** (Free tier)
   - Analytical tone
   - All major sports
   - Full feature set

2. **Coach Mike** (Premium tier)
   - Motivational tone
   - NFL, NBA, MLB
   - Voice and analysis features

3. **Sarah Pro** (Pro tier)
   - Professional tone
   - All sports including Soccer
   - Complete feature set

## Query Patterns

### Common Queries

1. **Get available sidekicks for user tier**
   ```typescript
   const sidekicks = await db.collection('sidekicks')
     .where('isActive', '==', true)
     .where('pricing.tier', 'in', allowedTiers)
     .orderBy('name')
     .get();
   ```

2. **Get user's current selection**
   ```typescript
   const selection = await db.collection('userSidekickSelections')
     .where('userId', '==', userId)
     .where('isActive', '==', true)
     .limit(1)
     .get();
   ```

3. **Get user's selection history**
   ```typescript
   const history = await db.collection('userSidekickSelections')
     .where('userId', '==', userId)
     .orderBy('selectionDate', 'desc')
     .limit(10)
     .get();
   ```

### Performance Considerations

- Use composite indexes for multi-field queries
- Limit query results with `.limit()`
- Use pagination for large result sets
- Cache frequently accessed data
- Use subcollections for user-specific data when appropriate

## Backup and Recovery

- Enable automatic backups for production
- Regular exports for data analysis
- Point-in-time recovery capability
- Test restore procedures regularly

---

*This schema supports the Sidekick Selection System API. For API documentation, see [API Reference](./api/API_REFERENCE.md).*
