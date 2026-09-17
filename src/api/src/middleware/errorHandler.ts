import type { Context } from "hono";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";

export function handleRouteError(c: Context, err: unknown) {
  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404);
  }

  if (err instanceof ConflictError) {
    return c.json({ error: err.message }, 409);
  }

  if (err instanceof ValidationError) {
    return c.json(
      {
        error: err.message,
        ...(err.details && typeof err.details === "object" ? err.details : {}),
      },
      400,
    );
  }

  throw err;
}
