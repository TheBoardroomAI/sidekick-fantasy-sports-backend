/**
 * Firestore Migration: Add PreferredName Support
 * 
 * This script adds preferredName support to existing user documents
 * and userSidekickSelections collection.
 * 
 * Run with: node migrations/add-preferred-name-support.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (use your service account key)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Or use service account key:
    // credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function migrateUsersCollection() {
  console.log('Starting users collection migration...');

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const userData = doc.data();

    // Only update if preferences.preferredName doesn't exist
    if (!userData.preferences?.preferredName) {
      const updateData = {
        'preferences.preferredName': userData.displayName || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      batch.update(doc.ref, updateData);
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`✅ Updated ${count} user documents with preferredName field`);
  } else {
    console.log('ℹ️ All users already have preferredName field');
  }
}

async function migrateUserSidekickSelections() {
  console.log('Starting userSidekickSelections collection migration...');

  const selectionsRef = db.collection('userSidekickSelections');
  const snapshot = await selectionsRef.get();

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const selectionData = doc.data();

    // Only update if preferredName doesn't exist
    if (!selectionData.preferredName) {
      // Get user's preferred name or displayName
      const userDoc = await db.collection('users').doc(selectionData.userId).get();
      const userData = userDoc.data();

      const preferredName = userData?.preferences?.preferredName || 
                           userData?.displayName || 
                           'User';

      const updateData = {
        preferredName: preferredName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      batch.update(doc.ref, updateData);
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`✅ Updated ${count} sidekick selection documents with preferredName field`);
  } else {
    console.log('ℹ️ All sidekick selections already have preferredName field');
  }
}

async function addFirestoreIndexes() {
  console.log('Adding Firestore indexes...');

  // Note: Firestore indexes are typically managed via firestore.indexes.json
  // This function creates the index configuration that should be added to that file

  const indexConfig = {
    indexes: [
      {
        collectionGroup: "users",
        queryScope: "COLLECTION",
        fields: [
          {
            fieldPath: "preferences.preferredName",
            order: "ASCENDING"
          },
          {
            fieldPath: "updatedAt",
            order: "DESCENDING"
          }
        ]
      },
      {
        collectionGroup: "userSidekickSelections",
        queryScope: "COLLECTION",
        fields: [
          {
            fieldPath: "userId",
            order: "ASCENDING"
          },
          {
            fieldPath: "preferredName",
            order: "ASCENDING"
          },
          {
            fieldPath: "isActive",
            order: "ASCENDING"
          }
        ]
      }
    ]
  };

  console.log('Add the following to your firestore.indexes.json file:');
  console.log(JSON.stringify(indexConfig, null, 2));
  console.log('Then run: firebase deploy --only firestore:indexes');
}

async function runMigration() {
  try {
    console.log('🚀 Starting preferredName migration...');

    await migrateUsersCollection();
    await migrateUserSidekickSelections();
    await addFirestoreIndexes();

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  migrateUsersCollection,
  migrateUserSidekickSelections,
  addFirestoreIndexes,
  runMigration
};
