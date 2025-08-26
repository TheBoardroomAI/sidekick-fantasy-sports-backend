import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface SubscriptionRequirement {
  tiers: string[];
  feature?: string;
  personaId?: string;
}

// Subscription tier hierarchy (higher number = higher tier)
const TIER_HIERARCHY: Record<string, number> = {
  'rookie': 1,
  'pro': 2,
  'champion': 3
};

// Feature access mapping
const FEATURE_ACCESS: Record<string, string[]> = {
  // Persona access
  'persona:rookie': ['rookie', 'pro', 'champion'],
  'persona:mentor': ['rookie', 'pro', 'champion'],
  'persona:analyst': ['pro', 'champion'],
  'persona:oracle': ['pro', 'champion'],
  'persona:rebel': ['pro', 'champion'],
  'persona:zane': ['champion'],
  
  // Feature access
  'draft-room': ['pro', 'champion'],
  'advanced-analytics': ['champion'],
  'voice-interaction': ['pro', 'champion'],
  'real-time-updates': ['pro', 'champion'],
  'priority-support': ['champion'],
  'unlimited-queries': ['champion']
};

// Endpoint access requirements
const ENDPOINT_REQUIREMENTS: Record<string, SubscriptionRequirement> = {
  // Persona chat endpoints
  '/personas/oracle/chat': { tiers: ['pro', 'champion'], personaId: 'oracle' },
  '/personas/rebel/chat': { tiers: ['pro', 'champion'], personaId: 'rebel' },
  '/personas/analyst/chat': { tiers: ['pro', 'champion'], personaId: 'analyst' },
  '/personas/zane/chat': { tiers: ['champion'], personaId: 'zane' },
  
  // Draft room endpoints
  '/draft-room': { tiers: ['pro', 'champion'], feature: 'draft-room' },
  '/draft-room/create': { tiers: ['pro', 'champion'], feature: 'draft-room' },
  '/draft-room/join': { tiers: ['pro', 'champion'], feature: 'draft-room' },
  
  // Advanced analytics
  '/data/advanced': { tiers: ['champion'], feature: 'advanced-analytics' },
  '/analytics/advanced': { tiers: ['champion'], feature: 'advanced-analytics' },
  
  // Voice endpoints
  '/voice/generate': { tiers: ['pro', 'champion'], feature: 'voice-interaction' },
  '/voice/clone': { tiers: ['champion'], feature: 'voice-interaction' },
  
  // Real-time endpoints
  '/realtime/subscribe': { tiers: ['pro', 'champion'], feature: 'real-time-updates' },
  '/realtime/publish': { tiers: ['pro', 'champion'], feature: 'real-time-updates' }
};

export async function enforceSubscriptionTier(
  req: functions.https.Request & { user?: any },
  res: functions.Response,
  next?: () => void
): Promise<void> {
  try {
    // Extract user ID from request
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Get endpoint requirement
    const requirement = getEndpointRequirement(req.path, req.method);
    
    if (!requirement) {
      // No subscription requirement for this endpoint
      if (next) next();
      return;
    }

    // Get user subscription status
    const userSubscription = await getUserSubscription(userId);
    
    if (!userSubscription) {
      res.status(403).json({
        error: 'Subscription information not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
      return;
    }

    // Check if user has required tier
    const hasAccess = checkTierAccess(userSubscription.tier, requirement.tiers);
    
    if (!hasAccess) {
      const requiredTier = getMinimumRequiredTier(requirement.tiers);
      
      res.status(403).json({
        error: 'Subscription upgrade required',
        code: 'UPGRADE_REQUIRED',
        currentTier: userSubscription.tier,
        requiredTier,
        feature: requirement.feature || requirement.personaId,
        upgradeUrl: '/pricing'
      });
      return;
    }

    // Check if subscription is active
    if (!userSubscription.isActive) {
      res.status(403).json({
        error: 'Subscription is not active',
        code: 'SUBSCRIPTION_INACTIVE',
        tier: userSubscription.tier,
        renewUrl: '/billing'
      });
      return;
    }

    // Add subscription info to request for downstream use
    req.user = {
      ...req.user,
      subscription: userSubscription
    };

    if (next) next();
  } catch (error) {
    console.error('Subscription enforcement error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Get endpoint requirement based on path and method
function getEndpointRequirement(path: string, method: string): SubscriptionRequirement | null {
  // Direct path match
  if (ENDPOINT_REQUIREMENTS[path]) {
    return ENDPOINT_REQUIREMENTS[path];
  }

  // Pattern matching for dynamic routes
  for (const [pattern, requirement] of Object.entries(ENDPOINT_REQUIREMENTS)) {
    if (matchesPattern(path, pattern)) {
      return requirement;
    }
  }

  return null;
}

// Simple pattern matching for routes
function matchesPattern(path: string, pattern: string): boolean {
  // Convert pattern to regex (simple implementation)
  const regexPattern = pattern
    .replace(/:\w+/g, '[^/]+') // Replace :param with [^/]+
    .replace(/\*/g, '.*'); // Replace * with .*
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

// Get user subscription from Firestore
async function getUserSubscription(userId: string) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    
    return {
      tier: userData?.subscriptionTier || 'rookie',
      isActive: userData?.subscriptionActive !== false,
      expiresAt: userData?.subscriptionExpiresAt,
      stripeCustomerId: userData?.stripeCustomerId,
      features: getFeaturesByTier(userData?.subscriptionTier || 'rookie')
    };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return null;
  }
}

// Check if user tier has access to required tiers
function checkTierAccess(userTier: string, requiredTiers: string[]): boolean {
  const userTierLevel = TIER_HIERARCHY[userTier] || 0;
  const minRequiredLevel = Math.min(...requiredTiers.map(tier => TIER_HIERARCHY[tier] || 0));
  
  return userTierLevel >= minRequiredLevel;
}

// Get minimum required tier from list
function getMinimumRequiredTier(requiredTiers: string[]): string {
  return requiredTiers.reduce((min, tier) => {
    const minLevel = TIER_HIERARCHY[min] || 0;
    const tierLevel = TIER_HIERARCHY[tier] || 0;
    return tierLevel < minLevel ? tier : min;
  });
}

// Get features available for a tier
function getFeaturesByTier(tier: string): string[] {
  const features: string[] = [];
  
  for (const [feature, allowedTiers] of Object.entries(FEATURE_ACCESS)) {
    if (allowedTiers.includes(tier)) {
      features.push(feature);
    }
  }
  
  return features;
}

// Middleware factory for specific requirements
export function requireSubscription(requirement: SubscriptionRequirement) {
  return async (req: functions.https.Request & { user?: any }, res: functions.Response, next?: () => void) => {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const userSubscription = await getUserSubscription(userId);
    
    if (!userSubscription) {
      res.status(403).json({
        error: 'Subscription information not found',
        code: 'SUBSCRIPTION_NOT_FOUND'
      });
      return;
    }

    const hasAccess = checkTierAccess(userSubscription.tier, requirement.tiers);
    
    if (!hasAccess || !userSubscription.isActive) {
      const requiredTier = getMinimumRequiredTier(requirement.tiers);
      
      res.status(403).json({
        error: 'Subscription upgrade required',
        code: 'UPGRADE_REQUIRED',
        currentTier: userSubscription.tier,
        requiredTier,
        feature: requirement.feature || requirement.personaId
      });
      return;
    }

    if (next) next();
  };
}

// Helper function to check feature access
export async function hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
  try {
    const userSubscription = await getUserSubscription(userId);
    
    if (!userSubscription || !userSubscription.isActive) {
      return false;
    }

    const allowedTiers = FEATURE_ACCESS[feature];
    
    if (!allowedTiers) {
      return true; // Feature not restricted
    }

    return allowedTiers.includes(userSubscription.tier);
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
}

// Helper function to check persona access
export async function hasPersonaAccess(userId: string, personaId: string): Promise<boolean> {
  return hasFeatureAccess(userId, `persona:${personaId}`);
}

