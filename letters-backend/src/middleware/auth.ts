import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import * as db from "../db/queries.js";
import type { User } from "../db/schema.js";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User | null;
    }
  }
}

/**
 * Authentication middleware
 * Verifies Supabase JWT and attaches user to request
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      req.user = null;
      next();
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      req.user = null;
      next();
      return;
    }

    // Get or create user in our database
    let user = await db.getUserBySupabaseId(supabaseUser.id);

    if (!user) {
      // Create new user
      const userId = await db.createUser({
        supabaseId: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0],
      });
      user = await db.getUserBySupabaseId(supabaseUser.id);
    } else {
      // Update last sign in
      await db.updateUserLastSignIn(user.id);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    req.user = null;
    next();
  }
}

/**
 * Get user from request for tRPC context
 */
export function getUserFromRequest(req: Request): User | null {
  return req.user || null;
}
