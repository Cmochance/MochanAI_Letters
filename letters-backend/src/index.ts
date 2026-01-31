import "dotenv/config";
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./context.js";
import { authMiddleware, getUserFromRequest } from "./middleware/auth.js";

const app = express();
const port = parseInt(process.env.PORT || "30080");

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3001";
app.use(
  cors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Auth middleware
app.use(authMiddleware);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

// tRPC middleware
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

// Start server
app.listen(port, () => {
  console.log(`[api] Server listening on port ${port}`);
  console.log(`[api] CORS origin: ${corsOrigin}`);
  console.log(`[api] Environment: ${process.env.NODE_ENV || "development"}`);
});
