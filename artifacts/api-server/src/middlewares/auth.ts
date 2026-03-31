import { type Request, type Response, type NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.PH_SECRET;

  if (!secret) {
    res.status(500).json({ error: "PH_SECRET is not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== secret) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  next();
}
