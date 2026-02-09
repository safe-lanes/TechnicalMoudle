export class BulkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkValidationError';
  }
}

export class BulkNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkNotFoundError';
  }
}

export class BulkConflictError extends Error {
  public conflicts: any[];
  constructor(message: string, conflicts: any[] = []) {
    super(message);
    this.name = 'BulkConflictError';
    this.conflicts = conflicts;
  }
}

export class BulkImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkImportError';
  }
}
