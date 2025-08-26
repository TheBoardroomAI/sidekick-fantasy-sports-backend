import * as functions from "firebase-functions";
import DOMPurify from "isomorphic-dompurify";

// Input validation configuration
interface ValidationRule {
  required?: boolean;
  type?: "string" | "number" | "boolean" | "email" | "url" | "array" | "object";
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  sanitize?: boolean;
  customValidator?: (value: any) => boolean | string;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

export class InputValidator {
  // Sanitize HTML content
  static sanitizeHtml(input: string): string {
    if (typeof input !== "string") {
      return "";
    }
    
    // Remove all HTML tags and scripts
    return DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  }

  // Escape special characters for SQL/NoSQL injection prevention
  static escapeSpecialChars(input: string): string {
    if (typeof input !== "string") {
      return "";
    }
    
    return input
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/['"]/g, "") // Remove quotes
      .replace(/[\\]/g, "") // Remove backslashes
      .replace(/[{}]/g, "") // Remove curly braces
      .replace(/[\[\]]/g, "") // Remove square brackets
      .replace(/[;]/g, "") // Remove semicolons
      .trim();
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate URL format
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Check for common injection patterns
  static containsInjectionPatterns(input: string): boolean {
    const injectionPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript protocol
      /on\w+\s*=/gi, // Event handlers
      /eval\s*\(/gi, // Eval function
      /expression\s*\(/gi, // CSS expression
      /vbscript:/gi, // VBScript protocol
      /data:text\/html/gi, // Data URLs with HTML
      /\$\{.*\}/g, // Template literals
      /\{\{.*\}\}/g, // Template expressions
    ];
    
    return injectionPatterns.some(pattern => pattern.test(input));
  }

  // Validate single field
  static validateField(value: any, rule: ValidationRule, fieldName: string): { valid: boolean; error?: string; sanitizedValue?: any } {
    // Check if required
    if (rule.required && (value === undefined || value === null || value === "")) {
      return { valid: false, error: `${fieldName} is required` };
    }
    
    // If not required and empty, return valid
    if (!rule.required && (value === undefined || value === null || value === "")) {
      return { valid: true, sanitizedValue: value };
    }
    
    let sanitizedValue = value;
    
    // Type validation
    if (rule.type) {
      switch (rule.type) {
      case "string":
        if (typeof value !== "string") {
          return { valid: false, error: `${fieldName} must be a string` };
        }
          
        // Sanitize string if requested
        if (rule.sanitize) {
          sanitizedValue = this.sanitizeHtml(value);
          sanitizedValue = this.escapeSpecialChars(sanitizedValue);
        }
          
        // Check for injection patterns
        if (this.containsInjectionPatterns(value)) {
          return { valid: false, error: `${fieldName} contains potentially dangerous content` };
        }
          
        break;
          
      case "number":
        if (typeof value !== "number" && !Number.isFinite(Number(value))) {
          return { valid: false, error: `${fieldName} must be a number` };
        }
        sanitizedValue = Number(value);
        break;
          
      case "boolean":
        if (typeof value !== "boolean") {
          return { valid: false, error: `${fieldName} must be a boolean` };
        }
        break;
          
      case "email":
        if (typeof value !== "string" || !this.isValidEmail(value)) {
          return { valid: false, error: `${fieldName} must be a valid email address` };
        }
        sanitizedValue = value.toLowerCase().trim();
        break;
          
      case "url":
        if (typeof value !== "string" || !this.isValidUrl(value)) {
          return { valid: false, error: `${fieldName} must be a valid URL` };
        }
        break;
          
      case "array":
        if (!Array.isArray(value)) {
          return { valid: false, error: `${fieldName} must be an array` };
        }
        break;
          
      case "object":
        if (typeof value !== "object" || Array.isArray(value) || value === null) {
          return { valid: false, error: `${fieldName} must be an object` };
        }
        break;
      }
    }
    
    // Length validation for strings and arrays
    if (rule.minLength !== undefined) {
      const length = typeof sanitizedValue === "string" ? sanitizedValue.length : 
        Array.isArray(sanitizedValue) ? sanitizedValue.length : 0;
      if (length < rule.minLength) {
        return { valid: false, error: `${fieldName} must be at least ${rule.minLength} characters/items long` };
      }
    }
    
    if (rule.maxLength !== undefined) {
      const length = typeof sanitizedValue === "string" ? sanitizedValue.length : 
        Array.isArray(sanitizedValue) ? sanitizedValue.length : 0;
      if (length > rule.maxLength) {
        return { valid: false, error: `${fieldName} must be no more than ${rule.maxLength} characters/items long` };
      }
    }
    
    // Numeric range validation
    if (rule.min !== undefined && typeof sanitizedValue === "number") {
      if (sanitizedValue < rule.min) {
        return { valid: false, error: `${fieldName} must be at least ${rule.min}` };
      }
    }
    
    if (rule.max !== undefined && typeof sanitizedValue === "number") {
      if (sanitizedValue > rule.max) {
        return { valid: false, error: `${fieldName} must be no more than ${rule.max}` };
      }
    }
    
    // Pattern validation
    if (rule.pattern && typeof sanitizedValue === "string") {
      if (!rule.pattern.test(sanitizedValue)) {
        return { valid: false, error: `${fieldName} format is invalid` };
      }
    }
    
    // Allowed values validation
    if (rule.allowedValues && !rule.allowedValues.includes(sanitizedValue)) {
      return { valid: false, error: `${fieldName} must be one of: ${rule.allowedValues.join(", ")}` };
    }
    
    // Custom validation
    if (rule.customValidator) {
      const customResult = rule.customValidator(sanitizedValue);
      if (customResult !== true) {
        return { 
          valid: false, 
          error: typeof customResult === "string" ? customResult : `${fieldName} is invalid` 
        };
      }
    }
    
    return { valid: true, sanitizedValue };
  }

  // Validate entire object against schema
  static validate(data: any, schema: ValidationSchema): { valid: boolean; errors: string[]; sanitizedData?: any } {
    const errors: string[] = [];
    const sanitizedData: any = {};
    
    // Validate each field in schema
    for (const [fieldName, rule] of Object.entries(schema)) {
      const fieldValue = data?.[fieldName];
      const result = this.validateField(fieldValue, rule, fieldName);
      
      if (!result.valid) {
        errors.push(result.error!);
      } else {
        sanitizedData[fieldName] = result.sanitizedValue;
      }
    }
    
    // Check for unexpected fields (potential injection attempt)
    if (data && typeof data === "object") {
      const allowedFields = Object.keys(schema);
      const providedFields = Object.keys(data);
      const unexpectedFields = providedFields.filter(field => !allowedFields.includes(field));
      
      if (unexpectedFields.length > 0) {
        errors.push(`Unexpected fields: ${unexpectedFields.join(", ")}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }
}

// Middleware factory for request validation
export function validateRequest(schema: ValidationSchema) {
  return (req: functions.https.Request, res: functions.Response, next?: () => void): void => {
    try {
      const result = InputValidator.validate(req.body, schema);
      
      if (!result.valid) {
        res.status(400).json({
          error: "Validation failed",
          details: result.errors,
          code: "VALIDATION_ERROR"
        });
        return;
      }
      
      // Replace request body with sanitized data
      req.body = result.sanitizedData;
      
      if (next) next();
      
    } catch (error: any) {
      console.error("Validation middleware error:", error);
      res.status(500).json({
        error: "Internal validation error",
        code: "VALIDATION_INTERNAL_ERROR"
      });
    }
  };
}

// Common validation schemas
export const ValidationSchemas = {
  // User registration
  userRegistration: {
    email: { 
      required: true, 
      type: "email" as const,
      maxLength: 254,
      sanitize: true
    },
    password: { 
      required: true, 
      type: "string" as const,
      minLength: 6,
      maxLength: 128
    },
    displayName: { 
      required: true, 
      type: "string" as const,
      minLength: 1,
      maxLength: 50,
      sanitize: true,
      pattern: /^[a-zA-Z0-9\s\-_]+$/
    }
  },
  
  // User login
  userLogin: {
    email: { 
      required: true, 
      type: "email" as const,
      sanitize: true
    },
    password: { 
      required: true, 
      type: "string" as const,
      minLength: 1,
      maxLength: 128
    }
  },
  
  // Persona chat
  personaChat: {
    message: { 
      required: true, 
      type: "string" as const,
      minLength: 1,
      maxLength: 2000,
      sanitize: true
    },
    personaId: { 
      required: true, 
      type: "string" as const,
      allowedValues: ["rookie", "mentor", "analyst", "oracle", "rebel", "zane"]
    },
    conversationId: { 
      required: false, 
      type: "string" as const,
      pattern: /^[a-zA-Z0-9_-]+$/
    }
  },
  
  // Voice input
  voiceInput: {
    audioData: { 
      required: true, 
      type: "string" as const,
      maxLength: 10000000 // 10MB base64 limit
    },
    personaId: { 
      required: true, 
      type: "string" as const,
      allowedValues: ["rookie", "mentor", "analyst", "oracle", "rebel", "zane"]
    },
    format: { 
      required: false, 
      type: "string" as const,
      allowedValues: ["wav", "mp3", "webm"]
    }
  },
  
  // Subscription checkout
  subscriptionCheckout: {
    tier: { 
      required: true, 
      type: "string" as const,
      allowedValues: ["rookie", "pro", "champion"]
    }
  },
  
  // Data query
  dataQuery: {
    position: { 
      required: false, 
      type: "string" as const,
      allowedValues: ["QB", "RB", "WR", "TE", "K", "DST"]
    },
    week: { 
      required: false, 
      type: "number" as const,
      min: 1,
      max: 18
    },
    limit: { 
      required: false, 
      type: "number" as const,
      min: 1,
      max: 100
    }
  }
};

