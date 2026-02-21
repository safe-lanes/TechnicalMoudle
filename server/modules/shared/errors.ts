export class AppError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: any) {
    super(404, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: any) {
    super(400, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: any) {
    super(409, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: any) {
    super(403, message, details);
  }
}
