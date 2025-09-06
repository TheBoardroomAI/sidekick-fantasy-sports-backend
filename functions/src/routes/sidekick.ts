import { Router, Request, Response } from 'express';
import { sidekickSelectionManager, SidekickSelectionContext } from '../services/sidekickSelectionManager';
import { authenticateUser } from '../middleware/auth';
import { validateSidekickSelection, validatePreferencesUpdate } from '../middleware/inputValidation';
import { validateSidekickSelectionWithName, validatePreferredNameUpdate } from '../utils/preferredNameValidation';
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
 * Select a sidekick for the authenticated user (legacy endpoint - maintains backward compatibility)
 */
router.post('/select',
  authenticateUser,
  validateSidekickSelection,
  applyRateLimit({ windowMs: 60000, max: 10 }), // 10 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { sidekickId, preferences } = req.body;
      const subscriptionTier = req.user.subscription?.tier || 'free';

      // Use default name for backward compatibility
      const selectionData = {
        sidekickId,
        preferredName: req.user.displayName || 'User',
        preferences
      };

      const selection = await sidekickSelectionManager.selectSidekickWithName(
        userId, 
        selectionData,
        subscriptionTier
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
      res.status(500).json({
        success: false,
        error: 'Failed to select sidekick',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * NEW: POST /sidekicks/select-with-name
 * Select a sidekick with preferred name for the authenticated user
 */
router.post('/select-with-name',
  authenticateUser,
  validateSidekickSelectionWithName,
  applyRateLimit({ windowMs: 60000, max: 10 }), // 10 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { sidekickId, preferredName, preferences } = req.body;
      const subscriptionTier = req.user.subscription?.tier || 'free';

      const selectionData = {
        sidekickId,
        preferredName,
        preferences
      };

      const selection = await sidekickSelectionManager.selectSidekickWithName(
        userId, 
        selectionData,
        subscriptionTier
      );

      res.json({
        success: true,
        data: {
          selection,
          message: `Sidekick selected successfully with preferred name: ${preferredName}`
        }
      });

    } catch (error) {
      logger.error('Error selecting sidekick with preferred name:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to select sidekick with preferred name',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * NEW: PUT /sidekicks/preferred-name
 * Update preferred name for current sidekick selection
 */
router.put('/preferred-name',
  authenticateUser,
  validatePreferredNameUpdate,
  applyRateLimit({ windowMs: 60000, max: 20 }), // 20 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { preferredName } = req.body;

      await sidekickSelectionManager.updatePreferredName(userId, preferredName);

      res.json({
        success: true,
        data: {
          preferredName,
          message: 'Preferred name updated successfully'
        }
      });

    } catch (error) {
      logger.error('Error updating preferred name:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferred name',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /sidekicks/current
 * Get user's current sidekick selection with preferred name
 */
router.get('/current',
  authenticateUser,
  applyRateLimit({ windowMs: 60000, max: 30 }), // 30 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;

      const selectionStatus = await sidekickSelectionManager.getUserSelectionStatus(userId);

      res.json({
        success: true,
        data: selectionStatus
      });

    } catch (error) {
      logger.error('Error getting current selection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve current selection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /sidekicks/selection
 * Remove current sidekick selection
 */
router.delete('/selection',
  authenticateUser,
  applyRateLimit({ windowMs: 60000, max: 5 }), // 5 requests per minute
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;

      // Deactivate selection (preserve history)
      const selection = await sidekickSelectionManager.getCurrentSelection(userId);
      if (!selection) {
        return res.status(404).json({
          success: false,
          error: 'No active selection found'
        });
      }

      // Update to inactive
      await sidekickSelectionManager.updatePreferredName(userId, ''); // This will need to be enhanced

      res.json({
        success: true,
        data: {
          message: 'Sidekick selection removed successfully'
        }
      });

    } catch (error) {
      logger.error('Error removing sidekick selection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove sidekick selection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;
