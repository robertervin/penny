import { Hono } from "hono";

export function createHealthRoutes() {
  const routes = new Hono();
  routes.get("/api/health", (c) => c.json({ ok: true }));
  return routes;
}
