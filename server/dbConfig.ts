/**
 * TEMPORARY DATABASE CONFIGURATION FALLBACK
 * 
 * This module provides a fallback for when Replit's secret injection fails.
 * It reads database configuration from a local config file when environment
 * variables are not available.
 * 
 * IMPORTANT: This is a TEMPORARY workaround and should be removed once
 * Replit's secret injection is fixed.
 * 
 * SECURITY NOTE: The config file (db.config.json) is excluded from git.
 */

import * as fs from 'fs';
import * as path from 'path';

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const CONFIG_FILE_PATH = path.join(process.cwd(), 'db.config.json');

/**
 * Read database configuration from local config file
 * Returns undefined if file doesn't exist or is invalid
 */
function readConfigFile(): DbConfig | undefined {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const config = JSON.parse(content) as DbConfig;
      
      if (config.host && config.port && config.user && config.password && config.database) {
        console.log('[DbConfig] TEMPORARY FALLBACK: Using local db.config.json');
        console.log('[DbConfig] This is a workaround for Replit secret injection issues');
        return config;
      }
    }
  } catch (error) {
    console.error('[DbConfig] Error reading config file:', error);
  }
  return undefined;
}

/**
 * Get PostgreSQL connection string
 * Priority:
 * 1. DATABASE_URL environment variable
 * 2. Constructed from PG* environment variables
 * 3. Local config file (db.config.json) - TEMPORARY FALLBACK
 */
export function getDatabaseUrl(): string | undefined {
  // Priority 1: Use DATABASE_URL if available
  if (process.env.DATABASE_URL) {
    console.log('[DbConfig] Using DATABASE_URL from environment');
    return process.env.DATABASE_URL;
  }
  
  // Priority 2: Construct from individual PG* environment variables
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (PGHOST && PGPORT && PGUSER && PGPASSWORD && PGDATABASE) {
    console.log('[DbConfig] Constructing connection string from PG* environment variables');
    return `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=require`;
  }
  
  // Priority 3: TEMPORARY FALLBACK - Read from local config file
  const config = readConfigFile();
  if (config) {
    return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}?sslmode=require`;
  }
  
  return undefined;
}

/**
 * Create a template config file if it doesn't exist
 * This helps users know what format is expected
 */
export function createConfigTemplate(): void {
  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    const template = {
      "_comment": "TEMPORARY DATABASE CONFIG - Delete this file once Replit secrets work",
      "host": "your-database-host.neon.tech",
      "port": 5432,
      "user": "your-username",
      "password": "your-password",
      "database": "your-database-name"
    };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(template, null, 2));
    console.log('[DbConfig] Created template config file at db.config.json');
    console.log('[DbConfig] Please fill in your database credentials');
  }
}
