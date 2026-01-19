import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import {
  getUserByEmail,
  getUserByOpenId,
  setUserPassword,
  upsertUser,
  verifyUserPassword,
} from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
        openId: string;
        name?: string | null;
        email?: string | null;
        loginMethod?: string | null;
        lastSignedIn?: Date | null;
      },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  if (ENV.authMode === "oauth") {
    app.get("/api/oauth/callback", async (req: Request, res: Response) => {
      const code = getQueryParam(req, "code");
      const state = getQueryParam(req, "state");

      if (!code || !state) {
        res.status(400).json({ error: "code and state are required" });
        return;
      }

      try {
        const tokenResponse = await sdk.exchangeCodeForToken(code, state);
        const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
        await syncUser(userInfo);
        const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const frontendUrl =
          process.env.EXPO_WEB_PREVIEW_URL ||
          process.env.EXPO_PACKAGER_PROXY_URL ||
          "http://localhost:8081";
        res.redirect(302, frontendUrl);
      } catch (error) {
        console.error("[OAuth] Callback failed", error);
        res.status(500).json({ error: "OAuth callback failed" });
      }
    });

    app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
      const code = getQueryParam(req, "code");
      const state = getQueryParam(req, "state");

      if (!code || !state) {
        res.status(400).json({ error: "code and state are required" });
        return;
      }

      try {
        const tokenResponse = await sdk.exchangeCodeForToken(code, state);
        const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
        const user = await syncUser(userInfo);

        const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        res.json({
          app_session_id: sessionToken,
          user: buildUserResponse(user),
        });
      } catch (error) {
        console.error("[OAuth] Mobile exchange failed", error);
        res.status(500).json({ error: "OAuth mobile exchange failed" });
      }
    });
  } else {
    app.get("/api/oauth/callback", (_req: Request, res: Response) => {
      res.status(404).json({ error: "oauth disabled" });
    });
    app.get("/api/oauth/mobile", (_req: Request, res: Response) => {
      res.status(404).json({ error: "oauth disabled" });
    });
  }

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    if (ENV.authMode !== "local") {
      res.status(400).json({ error: "local auth disabled" });
      return;
    }
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "invalid email" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }
    if (!ENV.cookieSecret) {
      res.status(500).json({ error: "JWT_SECRET is not configured" });
      return;
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "email already registered" });
      return;
    }

    const openId = `local_${crypto.randomUUID().replaceAll("-", "")}`;
    await upsertUser({
      openId,
      email,
      name: name || email,
      loginMethod: "local",
      lastSignedIn: new Date(),
    });
    const created = await getUserByEmail(email);
    if (!created) {
      res.status(500).json({ error: "failed to create user" });
      return;
    }
    await setUserPassword({ userId: created.id, password });

    const sessionToken = await sdk.createSessionToken(openId, {
      name: created.name || email,
      expiresInMs: ONE_YEAR_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ sessionToken, user: buildUserResponse(created) });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    if (ENV.authMode !== "local") {
      res.status(400).json({ error: "local auth disabled" });
      return;
    }
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "invalid email" });
      return;
    }
    if (!password) {
      res.status(400).json({ error: "password required" });
      return;
    }
    if (!ENV.cookieSecret) {
      res.status(500).json({ error: "JWT_SECRET is not configured" });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }
    const ok = await verifyUserPassword({ userId: user.id, password });
    if (!ok) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }

    await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || email,
      expiresInMs: ONE_YEAR_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ sessionToken, user: buildUserResponse(user) });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
