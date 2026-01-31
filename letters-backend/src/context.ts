import type { Request, Response } from "express";
import type { User } from "./db/schema.js";

export interface Context {
  req: Request;
  res: Response;
  user: User | null;
}

export function createContext({
  req,
  res,
  user,
}: {
  req: Request;
  res: Response;
  user: User | null;
}): Context {
  return {
    req,
    res,
    user,
  };
}
