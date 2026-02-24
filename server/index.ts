import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initStorage } from "./storage";
import { initializeDatabase } from "./initDb";
import { runBackupAndMigrations } from "./migrations";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize PostgreSQL-only storage (file-based storage has been removed)
  await initStorage();
  
  // Run database backup and schema migrations (idempotent - skips if already applied)
  await runBackupAndMigrations();
  
  // Run database migrations (adds new columns, tables, updates data format)
  await initializeDatabase();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  //
  // Detection: Use serveStatic (production) if:
  //   1. NODE_ENV is explicitly "production", OR
  //   2. dist/public/index.html exists (built assets present — handles Windows
  //      where NODE_ENV=production in package.json scripts doesn't work)
  const distPublicIndex = path.resolve(import.meta.dirname, "public", "index.html");
  const isProduction = app.get("env") === "production" || fs.existsSync(distPublicIndex);

  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5002;
  server.listen(
    {
      port,
      host: "127.0.0.1", // Force IPv4
      reusePort: false,  // <- must be false on Windows
    },
    () => {
    log(`serving on port ${port}`);
  });
})();
