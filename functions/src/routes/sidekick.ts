import { Router, Request, Response } from 'express';
import { sidekickSelectionManager, SidekickSelectionContext } from '../services/sidekickSelectionManager';
import { authenticateUser } from '../middleware/auth';
import { validateSidekickSelection, validatePreferencesUpdate } from '../middleware/inputValidation';
import { applyRateLimit } from '../middleware/rateLimiter';
import { logger } from 'firebase-functions';

const router = Router();

/**
 * GET /sidekicks/available
 * Get all available sidekicks for the authenticated user
 */
router.get('/available', 
  authenticateUser,
  applyRateLimit({ windowMs: 60000, max: 30 }), // 30 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const subscriptionTier = req.query.tier as 'free' | 'premium' | 'pro' || 'free';

      const sidekicks = await sidekickSelectionManager.getAvailableSidekicks(userId, subscriptionTier);

      res.json({
        success: true,
        data: {
          sidekicks,
          count: sidekicks.length,
          subscriptionTier
        }
      });

    } catch (error) {
      logger.error('Error getting available sidekicks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve available sidekicks',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /sidekicks/recommended
 * Get recommended sidekicks based on user profile
 */
router.get('/recommended',
  authenticateUser,
  applyRateLimit({ windowMs: 60000, max: 20 }), // 20 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;

      // Build context from user data (you'll need to implement getUserContext)
      const context: SidekickSelectionContext = {
        userProfile: req.user,
        currentSubscription: req.user.subscription || { tier: 'free' },
        preferredSports: req.query.sports ? (req.query.sports as string).split(',') : ['NFL'],
        usageHistory: [] // This would come from user's usage analytics
      };

      const recommendations = await sidekickSelectionManager.getRecommendedSidekicks(userId, context);

      res.json({
        success: true,
        data: {
          recommendations,
          count: recommendations.length,
          context: {
            preferredSports: context.preferredSports,
            subscriptionTier: context.currentSubscription.tier
          }
        }
      });

    } catch (error) {
      logger.error('Error getting recommended sidekicks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate sidekick recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /sidekicks/select
 * Select a sidekick for the authenticated user
 */
router.post('/select',
  authenticateUser,
  validateSidekickSelection,
  applyRateLimit({ windowMs: 60000, max: 10 }), // 10 selections per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { sidekickId, preferences } = req.body;

      const selection = await sidekickSelectionManager.selectSidekick(
        userId,
        sidekickId,
        preferences
      );

      res.json({
        success: true,
        data: {
          selection,
          message: 'Sidekick selected successfully'
        }
      });

    } catch (error) {
      logger.error('Error selecting sidekick:', error);

      let statusCode = 500;
      if (error instanceof Error) {
        if (error.message.includes('not found')) statusCode = 404;
        if (error.message.includes('not available')) statusCode = 410;
        if (error.message.includes('Insufficient subscription')) statusCode = 403;
      }

      res.status(statusCode).json({
        success: false,
        error: 'Failed to select sidekick',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /sidekicks/current
 * Get the user's current sidekick selection
 */
router.get('/current',
  authenticateUser,
  applyRateLimit({ windowMs: 60000, max: 60 }), // 60 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;

      const currentSelection = await sidekickSelectionManager.getCurrentSelection(userId);

      if (!currentSelection) {
        return res.json({
          success: true,
          data: {
            selection: null,
            message: 'No active sidekick selection found'
          }
        });
      }

      res.json({
        success: true,
        data: {
          selection: currentSelection
        }
      });

    } catch (error) {
      logger.error('Error getting current selection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve current sidekick selection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * PUT /sidekicks/preferences
 * Update sidekick preferences for the current user
 */
router.put('/preferences',
  authenticateUser,
  validatePreferencesUpdate,
  applyRateLimit({ windowMs: 60000, max: 30 }), // 30 updates per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { preferences } = req.body;

      await sidekickSelectionManager.updatePreferences(userId, preferences);

      res.json({
        success: true,
        data: {
          message: 'Preferences updated successfully',
          preferences
        }
      });

    } catch (error) {
      logger.error('Error updating preferences:', error);

      let statusCode = 500;
      if (error instanceof Error && error.message.includes('No active sidekick')) {
        statusCode = 404;
      }

      res.status(statusCode).json({
        success: false,
        error: 'Failed to update preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /sidekicks/history
 * Get the user's sidekick selection history
 */
router.get('/history',
  authenticateUser,
  applyRateLimit({ windowMs: 60000, max: 20 }), // 20 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const limit = parseInt(req.query.limit as string) || 10;

      if (limit > 50) {
        return res.status(400).json({
          success: false,
          error: 'Limit cannot exceed 50'
        });
      }

      const history = await sidekickSelectionManager.getSelectionHistory(userId, limit);

      res.json({
        success: true,
        data: {
          history,
          count: history.length,
          limit
        }
      });

    } catch (error) {
      logger.error('Error getting selection history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve sidekick selection history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /sidekicks/initialize
 * Initialize default sidekicks (admin only)
 */
router.post('/initialize',
  authenticateUser,
  applyRateLimit({ windowMs: 300000, max: 1 }), // 1 request per 5 minutes
  async (req: Request, res: Response) => {
    try {
      // Check if user has admin privileges (you'll need to implement this)
      const isAdmin = req.user?.customClaims?.admin === true;

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin privileges required'
        });
      }

      await sidekickSelectionManager.initializeDefaultSidekicks();

      res.json({
        success: true,
        data: {
          message: 'Default sidekicks initialized successfully'
        }
      });

    } catch (error) {
      logger.error('Error initializing default sidekicks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize default sidekicks',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;
