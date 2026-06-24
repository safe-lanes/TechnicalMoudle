import "./config/externalApi";
import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initStorage } from "./storage";
import { initializeDatabase } from "./initDb";
import { runBackupAndMigrations } from "./migrations";
import { tenantConnectionManager } from "./utils/tenantConnectionManager";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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
  // Initialize PostgreSQL storage
  await initStorage();
  
  // Run database backup and schema migrations (idempotent - skips if already applied)
  await runBackupAndMigrations();
  
  // Run database migrations (adds new columns, tables, updates data format)
  await initializeDatabase();

  // Multi-tenant: initialize the tenant connection manager. No-op + single-tenant
  // mode when MASTER_DATABASE_URL is unset (byte-identical boot to today); when set,
  // connects the master DB and applies migrations/master/*.sql.
  await tenantConnectionManager.init();

  // Resolve the sync instance identity BEFORE anything can write (schedulers
  // and startup tasks inside registerRoutes field-log their writes). The
  // field-logger resolves DB-first (sync_settings.instance_id) with env
  // SYNC_INSTANCE_ID as fallback and REFUSES placeholders — logs stamped
  // 'UNKNOWN' are invisible to the sync gather and silently never sync.
  try {
    const { initFieldLoggerInstanceId } = await import('./modules/sync/fieldLogger');
    const { getEffectiveInstanceId } = await import('./modules/sync/syncRole');
    const loggerId = await initFieldLoggerInstanceId();
    const engineId = await getEffectiveInstanceId();
    if (engineId !== loggerId) {
      console.warn(
        `[Startup] ⚠️ WARNING: field-logger instance id ('${loggerId}') != sync-engine instance id ('${engineId}'). ` +
        `Field logs written under one id are INVISIBLE to a gather running under the other — nothing will sync. ` +
        `Align sync_settings.instance_id and SYNC_INSTANCE_ID.`
      );
    } else {
      console.log(`[Startup] Sync instance identity OK: '${loggerId}' (field-logger and sync engine agree)`);
    }
  } catch (err: any) {
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('FATAL: SYNC INSTANCE ID NOT CONFIGURED — SERVER WILL NOT START');
    console.error(String(err?.message || err));
    console.error('Fix: INSERT/UPDATE sync_settings.instance_id (preferred), or set');
    console.error('the SYNC_INSTANCE_ID env var, then restart.');
    console.error('═══════════════════════════════════════════════════════════════');
    process.exit(1);
  }

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
  // Detection: setupVite (dev) ONLY if client/index.html exists on disk.
  // In production builds (dist/index.js), ../client/ doesn't exist, so
  // we always fall through to serveStatic. This works on Windows where
  // NODE_ENV=production in package.json scripts doesn't take effect.
  const clientIndexHtml = path.resolve(import.meta.dirname, "..", "client", "index.html");
  const isDevelopment = app.get("env") === "development" && fs.existsSync(clientIndexHtml);

  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT env var if set (Replit uses 5000), fallback to 5000
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: false,
    },
    () => {
    log(`serving on port ${port}`);
  });
})();
