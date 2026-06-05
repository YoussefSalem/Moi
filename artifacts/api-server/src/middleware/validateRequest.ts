import type { Request, Response, NextFunction } from "express";

export interface ZodLike {
  safeParse(data: unknown): {
    success: boolean;
    data?: unknown;
    error?: { issues: Array<{ path: (string | number)[]; message: string }> };
  };
}

/**
 * Express middleware factory that validates req.body against a Zod-compatible schema.
 * Returns HTTP 400 with structured error details on failure.
 */
export function validateBody(schema: ZodLike) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error?.issues ?? []).map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
