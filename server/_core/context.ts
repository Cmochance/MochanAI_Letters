import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user && (ENV.demoMode || ENV.authMode === "demo")) {
    const openId = ENV.demoOpenId;
    user = (await db.getUserByOpenId(openId)) ?? null;
    if (!user) {
      await db.upsertUser({
        openId,
        name: ENV.demoName,
        loginMethod: "demo",
        lastSignedIn: new Date(),
      });
      user = (await db.getUserByOpenId(openId)) ?? null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
