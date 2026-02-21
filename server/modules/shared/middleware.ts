import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errors';

// Wraps async route handlers — catches errors and maps them to HTTP responses
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: error.message,
          ...(error.details && { details: error.details })
        });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }
      console.error(`Unhandled error:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    });
  };
}

// Zod validation middleware
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.params = schema.parse(req.params) as any;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query) as any;
    next();
  };
}
