import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issuesList = err.issues || (err as any).errors || [];
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues: issuesList.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      res.status(400).json({ success: false, error: 'Malformed request payload' });
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issuesList = err.issues || (err as any).errors || [];
        res.status(400).json({
          success: false,
          error: 'Query parameter validation failed',
          issues: issuesList.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      res.status(400).json({ success: false, error: 'Malformed query parameters' });
    }
  };
}
