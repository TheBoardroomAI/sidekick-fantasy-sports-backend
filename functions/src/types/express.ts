import { Request, Response } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    subscriptionTier?: string;
  };
}

export { Request, Response };

