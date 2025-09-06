import { PreferredNameValidation } from '../models/user';

/**
 * Validate preferred name according to business rules
 */
export function validatePreferredName(preferredName: string): PreferredNameValidation {
  const errors: string[] = [];

  // Check if name is provided
  if (!preferredName || typeof preferredName !== 'string') {
    errors.push('Preferred name is required');
    return { isValid: false, errors };
  }

  // Trim whitespace
  const trimmedName = preferredName.trim();

  // Check length (1-50 characters)
  if (trimmedName.length < 1) {
    errors.push('Preferred name must be at least 1 character long');
  }

  if (trimmedName.length > 50) {
    errors.push('Preferred name must be 50 characters or less');
  }

  // Check for invalid characters (allow letters, numbers, spaces, hyphens, apostrophes)
  const validNamePattern = /^[a-zA-Z0-9\s\-']+$/;
  if (!validNamePattern.test(trimmedName)) {
    errors.push('Preferred name contains invalid characters. Only letters, numbers, spaces, hyphens, and apostrophes are allowed');
  }

  // Check for excessive whitespace
  if (/\s{2,}/.test(trimmedName)) {
    errors.push('Preferred name cannot contain multiple consecutive spaces');
  }

  // Check if starts or ends with whitespace
  if (trimmedName !== preferredName) {
    errors.push('Preferred name cannot start or end with spaces');
  }

  // Sanitize the name (remove extra spaces, capitalize appropriately)
  const sanitizedName = trimmedName
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedName: errors.length === 0 ? sanitizedName : undefined
  };
}

/**
 * Enhanced input validation middleware with preferredName support
 */
import { Request, Response, NextFunction } from 'express';

export const validateSidekickSelectionWithName = (req: Request, res: Response, next: NextFunction) => {
  const { sidekickId, preferredName, preferences } = req.body;

  // Validate sidekickId
  if (!sidekickId || typeof sidekickId !== 'string' || sidekickId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid sidekick ID',
      details: 'sidekickId is required and must be a non-empty string'
    });
  }

  // Validate preferredName
  const nameValidation = validatePreferredName(preferredName);
  if (!nameValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid preferred name',
      details: nameValidation.errors
    });
  }

  // Store sanitized name in request body
  req.body.preferredName = nameValidation.sanitizedName;

  // Validate preferences (optional)
  if (preferences) {
    if (typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences',
        details: 'preferences must be an object'
      });
    }

    // Validate individual preference fields if provided
    const validPrefs = ['notifications', 'voiceEnabled', 'realtimeUpdates'];
    for (const pref of validPrefs) {
      if (preferences[pref] !== undefined && typeof preferences[pref] !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: `Invalid ${pref}`,
          details: `${pref} must be a boolean value`
        });
      }
    }
  }

  next();
};

export const validatePreferredNameUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { preferredName } = req.body;

  const nameValidation = validatePreferredName(preferredName);
  if (!nameValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid preferred name',
      details: nameValidation.errors
    });
  }

  // Store sanitized name in request body
  req.body.preferredName = nameValidation.sanitizedName;
  next();
};

