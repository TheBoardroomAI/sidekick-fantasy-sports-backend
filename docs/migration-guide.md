# PreferredName Migration Guide

## Overview
This guide walks you through migrating from the basic sidekick selection system to the enhanced PreferredName feature. The migration maintains full backward compatibility while adding personalization capabilities.

## Pre-Migration Checklist

### Backend Requirements
- ✅ Firebase Admin SDK v11.0.0+
- ✅ Node.js v16.0.0+
- ✅ TypeScript v4.5.0+
- ✅ Existing Firestore database with users and sidekicks collections

### Frontend Requirements
- ✅ React v18.0.0+ (if using React)
- ✅ TypeScript v4.5.0+
- ✅ Fetch API or Axios for HTTP requests

## Migration Steps

### Step 1: Backend Migration

#### 1.1 Deploy Updated Backend Code
```bash
# Navigate to functions directory
cd functions

# Install dependencies (if new ones were added)
npm install

# Deploy functions
firebase deploy --only functions
```

#### 1.2 Run Database Migration
```bash
# Navigate to project root
cd ..

# Run migration script to add preferredName fields
node migrations/add-preferred-name-support.js
```

Expected output:
```
🚀 Starting preferredName migration...
✅ Updated 45 user documents with preferredName field
✅ Updated 23 sidekick selection documents with preferredName field
Add the following to your firestore.indexes.json file:
{
  "indexes": [
    // ... index configuration
  ]
}
Then run: firebase deploy --only firestore:indexes
✅ Migration completed successfully!
```

#### 1.3 Update Firestore Indexes
Add the provided index configuration to `firestore.indexes.json` and deploy:
```bash
firebase deploy --only firestore:indexes
```

### Step 2: Frontend SDK Migration

#### 2.1 Update SDK Import (No Changes Required)
```typescript
// Existing imports continue to work
import { SidekickClient } from './sdk/sidekick-client';
```

#### 2.2 Initialize Client (No Changes Required)
```typescript
// Existing initialization continues to work
const client = new SidekickClient({
  baseURL: 'https://your-api.com',
  authToken: userToken
});
```

#### 2.3 Update Sidekick Selection Logic

**Before (Legacy - Still Works):**
```typescript
// This continues to work unchanged
const selection = await client.selectSidekick('coach-mike', {
  notifications: true,
  voiceEnabled: true
});
```

**After (Enhanced):**
```typescript
// New method with preferred name
const selection = await client.selectSidekickWithName({
  sidekickId: 'coach-mike',
  preferredName: 'Alex', // User's preferred name
  preferences: {
    notifications: true,
    voiceEnabled: true,
    realtimeUpdates: false
  }
});
```

### Step 3: UI Components Migration

#### 3.1 Sidekick Selection Modal

**Before:**
```jsx
function SidekickSelectionModal({ sidekicks, onSelect }) {
  const [selectedId, setSelectedId] = useState('');

  const handleSelect = async () => {
    await onSelect(selectedId);
    onClose();
  };

  return (
    <Modal>
      <SidekickList sidekicks={sidekicks} onSelect={setSelectedId} />
      <Button onClick={handleSelect}>Select Sidekick</Button>
    </Modal>
  );
}
```

**After (Enhanced):**
```jsx
function SidekickSelectionModal({ sidekicks, onSelect }) {
  const [selectedId, setSelectedId] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [nameError, setNameError] = useState('');

  const validateAndSelect = async () => {
    const validation = client.validatePreferredName(preferredName);

    if (!validation.isValid) {
      setNameError(validation.errors.join(', '));
      return;
    }

    await onSelect({
      sidekickId: selectedId,
      preferredName: validation.sanitizedName
    });
    onClose();
  };

  return (
    <Modal>
      <SidekickList sidekicks={sidekicks} onSelect={setSelectedId} />

      {/* NEW: Preferred Name Input */}
      <div>
        <label>What should your sidekick call you?</label>
        <input
          value={preferredName}
          onChange={(e) => setPreferredName(e.target.value)}
          placeholder="Enter your preferred name"
          maxLength={50}
        />
        {nameError && <div className="error">{nameError}</div>}
      </div>

      <Button 
        onClick={validateAndSelect}
        disabled={!selectedId || !preferredName}
      >
        Select Sidekick
      </Button>
    </Modal>
  );
}
```

#### 3.2 Profile Settings Component

**New Component for Updating Preferred Name:**
```jsx
function PreferredNameSettings() {
  const [currentName, setCurrentName] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load current preferred name
    client.getCurrentSelection().then(result => {
      if (result.hasSelection) {
        const name = result.selectionData?.preferredName || '';
        setCurrentName(name);
        setNewName(name);
      }
    });
  }, []);

  const handleUpdate = async () => {
    setLoading(true);
    setError('');

    try {
      const validation = client.validatePreferredName(newName);
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      await client.updatePreferredName(validation.sanitizedName);
      setCurrentName(validation.sanitizedName);

      showSuccess('Preferred name updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="preferred-name-settings">
      <h3>How should your sidekick address you?</h3>
      <p>Current name: <strong>{currentName || 'Not set'}</strong></p>

      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Enter preferred name"
        maxLength={50}
      />

      {error && <div className="error">{error}</div>}

      <button 
        onClick={handleUpdate}
        disabled={loading || newName === currentName}
      >
        {loading ? 'Updating...' : 'Update Name'}
      </button>
    </div>
  );
}
```

### Step 4: React Hook Migration

#### Enhanced Hook with PreferredName Support
```typescript
export function useSidekickSelection() {
  const [currentSelection, setCurrentSelection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // NEW: Enhanced selection with preferred name
  const selectWithName = async (data: {
    sidekickId: string;
    preferredName: string;
    preferences?: any;
  }) => {
    setLoading(true);
    setError('');

    try {
      const selection = await client.selectSidekickWithName(data);
      setCurrentSelection(selection);
      return selection;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // NEW: Update preferred name
  const updatePreferredName = async (preferredName: string) => {
    setLoading(true);
    try {
      await client.updatePreferredName(preferredName);
      // Refresh current selection
      const updated = await client.getCurrentSelection();
      setCurrentSelection(updated.selectionData);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Load current selection on mount
  useEffect(() => {
    client.getCurrentSelection().then(result => {
      setCurrentSelection(result.selectionData);
    });

    // Listen for real-time updates
    const handlePreferredNameUpdate = (data) => {
      setCurrentSelection(prev => prev ? {
        ...prev, 
        preferredName: data.preferredName
      } : null);
    };

    client.on('preferred_name_updated', handlePreferredNameUpdate);

    return () => {
      client.off('preferred_name_updated', handlePreferredNameUpdate);
    };
  }, []);

  return {
    currentSelection,
    loading,
    error,
    selectWithName,
    updatePreferredName,
    validateName: client.validatePreferredName.bind(client),
    // Legacy method still available
    selectSidekick: client.selectSidekick.bind(client)
  };
}
```

### Step 5: Testing Migration

#### 5.1 Backend API Testing
```bash
# Test new endpoints
curl -X POST https://your-api.com/api/sidekicks/select-with-name \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sidekickId": "coach-mike", "preferredName": "Alex"}'

curl -X PUT https://your-api.com/api/sidekicks/preferred-name \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preferredName": "Alexandra"}'

curl -X GET https://your-api.com/api/sidekicks/current \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 5.2 Frontend Integration Testing
```typescript
// Test validation
console.log(client.validatePreferredName('Alex')); // Should be valid
console.log(client.validatePreferredName('A'.repeat(60))); // Should be invalid (too long)

// Test selection with name
try {
  const selection = await client.selectSidekickWithName({
    sidekickId: 'test-sidekick',
    preferredName: 'Test User'
  });
  console.log('Selection successful:', selection);
} catch (error) {
  console.error('Selection failed:', error);
}

// Test name update
try {
  await client.updatePreferredName('New Name');
  console.log('Name update successful');
} catch (error) {
  console.error('Name update failed:', error);
}
```

### Step 6: Rollback Plan

If issues occur during migration, you can rollback safely:

#### 6.1 Database Rollback (If Needed)
The migration adds fields but doesn't modify existing data. However, if rollback is needed:

```javascript
// Rollback script (migrations/rollback-preferred-name.js)
const admin = require('firebase-admin');
const db = admin.firestore();

async function rollbackPreferredName() {
  // Remove preferredName from users
  const usersSnapshot = await db.collection('users').get();
  const userBatch = db.batch();

  usersSnapshot.forEach(doc => {
    userBatch.update(doc.ref, {
      'preferences.preferredName': admin.firestore.FieldValue.delete()
    });
  });

  await userBatch.commit();

  // Remove preferredName from selections
  const selectionsSnapshot = await db.collection('userSidekickSelections').get();
  const selectionBatch = db.batch();

  selectionsSnapshot.forEach(doc => {
    selectionBatch.update(doc.ref, {
      preferredName: admin.firestore.FieldValue.delete()
    });
  });

  await selectionBatch.commit();

  console.log('Rollback completed');
}
```

#### 6.2 Code Rollback
Since the migration maintains backward compatibility:
- Legacy endpoints continue to work
- Frontend can use old methods without issues
- Simply revert to previous version of the code

### Troubleshooting

#### Common Issues

1. **Validation Errors**
   ```
   Error: Invalid preferred name: Preferred name must be 50 characters or less
   ```
   **Solution:** Ensure frontend validation matches backend rules

2. **Authentication Errors**
   ```
   Error: HTTP 401: Unauthorized
   ```
   **Solution:** Verify auth token is properly set in SDK

3. **Migration Script Fails**
   ```
   Error: Permission denied accessing collection 'users'
   ```
   **Solution:** Ensure Firebase Admin SDK has proper permissions

#### Performance Considerations

1. **Database Queries:** New fields are indexed for optimal performance
2. **API Response Times:** PreferredName adds minimal overhead (~5-10ms)
3. **Frontend Bundle Size:** SDK additions are minimal (~2KB)

### Best Practices

#### 1. Gradual Rollout
- Deploy backend changes first
- Run migration during low-traffic period
- Test thoroughly in staging environment
- Enable new frontend features gradually

#### 2. User Communication
- Notify users about new personalization features
- Provide clear instructions on setting preferred names
- Highlight benefits of personalized sidekick interactions

#### 3. Monitoring
- Monitor API response times after deployment
- Track preferred name validation error rates
- Monitor user adoption of new features

### Post-Migration

#### 1. Feature Enablement
After successful migration:
- Update frontend to use new preferred name flow
- Add user settings for name updates
- Consider onboarding flow for existing users

#### 2. Analytics Setup
Track adoption and usage:
```typescript
// Track preferred name usage
client.trackSidekickInteraction('preferred_name_set', {
  hasPreferredName: true,
  nameLength: preferredName.length
});
```

#### 3. User Education
- Send in-app notifications about new feature
- Add tooltips explaining preferred name benefits
- Include in user onboarding flow

## Migration Checklist

- [ ] Backend code deployed
- [ ] Database migration completed successfully  
- [ ] Firestore indexes updated
- [ ] API endpoints tested
- [ ] Frontend SDK updated
- [ ] UI components enhanced with preferred name input
- [ ] Validation working correctly
- [ ] Error handling implemented
- [ ] Analytics tracking added
- [ ] User documentation updated
- [ ] Support team briefed on new feature

## Support

For migration support:
- Check logs in Firebase Console
- Review API documentation in `/docs/preferred-name-api.md`
- Test endpoints with provided curl commands
- Use validation methods to debug name issues
