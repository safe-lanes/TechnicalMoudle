import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  errors?: ApiError[];
}

export function createSuccessResponse<T>(data: T): StandardApiResponse<T> {
  return {
    success: true,
    data
  };
}

export function createErrorResponse(
  code: string, 
  message: string, 
  field?: string, 
  details?: any
): StandardApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      field,
      details
    }
  };
}

export function createValidationErrorResponse(errors: ApiError[]): StandardApiResponse {
  return {
    success: false,
    errors
  };
}

export function formatZodErrors(error: ZodError): ApiError[] {
  return error.errors.map(err => ({
    code: 'VALIDATION_ERROR',
    message: err.message,
    field: err.path.join('.'),
    details: {
      type: err.code,
      expected: (err as any).expected,
      received: (err as any).received
    }
  }));
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        return res.status(400).json(createValidationErrorResponse(errors));
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        'Validation processing failed'
      ));
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        return res.status(400).json(createValidationErrorResponse(errors));
      }
      
      req.params = result.data as any;
      next();
    } catch (error) {
      console.error('Params validation error:', error);
      return res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        'Parameter validation failed'
      ));
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        return res.status(400).json(createValidationErrorResponse(errors));
      }
      
      req.query = result.data as any;
      next();
    } catch (error) {
      console.error('Query validation error:', error);
      return res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        'Query validation failed'
      ));
    }
  };
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Route error:', error);
      
      if (error.message?.includes('not found')) {
        return res.status(404).json(createErrorResponse(
          'NOT_FOUND',
          error.message
        ));
      }
      
      if (error.message?.includes('validation') || error.message?.includes('invalid')) {
        return res.status(400).json(createErrorResponse(
          'VALIDATION_ERROR',
          error.message
        ));
      }
      
      if (error.message?.includes('unauthorized') || error.message?.includes('permission')) {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          error.message
        ));
      }
      
      return res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        error.message || 'An unexpected error occurred'
      ));
    });
  };
};

export const commonValidationSchemas = {
  vesselId: z.string().min(1, 'Vessel ID is required'),
  componentId: z.string().uuid('Invalid component ID format'),
  workOrderId: z.string().uuid('Invalid work order ID format'),
  jobId: z.string().uuid('Invalid job ID format'),
  spareId: z.coerce.number().int().positive('Spare ID must be a positive integer'),
  pagination: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50)
  }),
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
};

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATE: 'INVALID_STATE',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR'
} as const;

export function notFoundError(resource: string, id?: string): never {
  throw new Error(`${resource}${id ? ` ${id}` : ''} not found`);
}

export function validationError(message: string): never {
  throw new Error(`validation: ${message}`);
}

export function businessRuleError(rule: string, message: string): ApiError {
  return {
    code: 'BUSINESS_RULE_VIOLATION',
    message,
    details: { rule }
  };
}
