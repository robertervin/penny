export class NotFoundError extends Error {
  readonly status = 404 as const;

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly status = 409 as const;

  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  readonly status = 400 as const;

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
