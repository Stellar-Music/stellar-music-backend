import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const { Pool } = pg;

export interface IDatabase {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<void>;
  close(): Promise<void>;
}

class PostgresDatabase implements IDatabase {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    await this.pool.query(sql, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class SqliteDatabase implements IDatabase {
  private db: DatabaseSync;

  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(filePath);
  }

  private normalizeSql(sql: string): string {
    // Replace PostgreSQL $1, $2 with SQLite ? parameter placeholders
    return sql.replace(/\$\d+/g, '?');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(this.normalizeSql(sql));
    const result = stmt.all(...params) as T[];
    return result;
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const stmt = this.db.prepare(this.normalizeSql(sql));
    const result = stmt.get(...params) as T | undefined;
    return result || null;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const stmt = this.db.prepare(this.normalizeSql(sql));
    stmt.run(...params);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

let dbInstance: IDatabase | null = null;

export async function getDb(): Promise<IDatabase> {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    try {
      const pgDb = new PostgresDatabase(databaseUrl);
      // Test connectivity
      await pgDb.query('SELECT 1');
      console.log('✅ Connected to PostgreSQL database');
      dbInstance = pgDb;
      return dbInstance;
    } catch (err: any) {
      console.warn(`⚠️ PostgreSQL connection failed (${err.message}). Falling back to local SQLite engine.`);
    }
  }

  const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'stellar_music.db');
  console.log(`📦 Using SQLite database at: ${dbPath}`);
  const sqliteDb = new SqliteDatabase(dbPath);
  dbInstance = sqliteDb;
  return dbInstance;
}

export async function initDb(): Promise<void> {
  const db = await getDb();

  // Unified DDL compatible with both SQLite and Postgres
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'LISTENER',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      artist_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      audio_reference TEXT NOT NULL,
      artwork_reference TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      genre TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS music_passes (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      purchaser_wallet TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      transaction_hash TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      purchased_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS streaming_sessions (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      listener_wallet TEXT NOT NULL,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_heartbeat TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS blockchain_transactions (
      id TEXT PRIMARY KEY,
      transaction_hash TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount REAL NOT NULL,
      asset TEXT NOT NULL DEFAULT 'XLM',
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      ledger INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Level 2 Tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS split_agreements (
      id TEXT PRIMARY KEY,
      track_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      agreement_hash TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      locked_at TEXT,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS split_contributors (
      id TEXT PRIMARY KEY,
      agreement_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      percentage REAL NOT NULL,
      share_basis_points INTEGER NOT NULL,
      has_signed INTEGER NOT NULL DEFAULT 0,
      signed_at TEXT,
      signature_ref TEXT,
      FOREIGN KEY (agreement_id) REFERENCES split_agreements(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS split_signatures (
      id TEXT PRIMARY KEY,
      agreement_id TEXT NOT NULL,
      contributor_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      signature_hash TEXT NOT NULL,
      signed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agreement_id) REFERENCES split_agreements(id) ON DELETE CASCADE,
      FOREIGN KEY (contributor_id) REFERENCES split_contributors(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS agreement_events (
      id TEXT PRIMARY KEY,
      agreement_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agreement_id) REFERENCES split_agreements(id) ON DELETE CASCADE
    );
  `);

  console.log('✅ Database schema initialized successfully');
}
