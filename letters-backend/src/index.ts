import "dotenv/config";
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./context.js";
import { authMiddleware, getUserFromRequest } from "./middleware/auth.js";

const app = express();
const port = parseInt(process.env.PORT || "30080");

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOriginPattern = process.env.CORS_ORIGIN_PATTERN;
const originPattern = corsOriginPattern ? new RegExp(corsOriginPattern) : null;

function isAllowedOrigin(origin?: string) {
  if (!origin) {
    return true;
  }

  if (corsOrigins.includes(origin)) {
    return true;
  }

  if (originPattern && originPattern.test(origin)) {
    return true;
  }

  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      console.warn("[cors] blocked origin", {
        origin,
        allowlist: corsOrigins,
        pattern: corsOriginPattern || null,
      });
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(authMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) =>
      createContext({
        req,
        res,
        user: getUserFromRequest(req),
      }),
  })
);

app.listen(port, () => {
  console.log(`[api] Server listening on port ${port}`);
  console.log(`[api] CORS allowlist: ${corsOrigins.join(", ") || "(empty)"}`);
  console.log(`[api] CORS pattern: ${corsOriginPattern || "(none)"}`);
  console.log(`[api] Environment: ${process.env.NODE_ENV || "development"}`);
});
