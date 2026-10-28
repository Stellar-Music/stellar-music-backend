import { Server } from 'node:http';
import { getDb } from '../db/database.js';

/**
 * Configure graceful shutdown handlers for process termination signals
 */
export function setupGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new incoming HTTP connections
    server.close(async (err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
        process.exit(1);
      }
      console.log('✅ HTTP server closed. Draining database connections...');

      try {
        const db = await getDb();
        if (db && typeof (db as any).close === 'function') {
          await (db as any).close();
          console.log('✅ Database connection closed.');
        }
      } catch (dbErr) {
        console.error('Error closing database connection:', dbErr);
      }

      console.log('👋 Stellar Music Backend shut down cleanly.');
      process.exit(0);
    });

    // Force exit after 10-second timeout if hanging
    setTimeout(() => {
      console.error('⚠️ Shutdown timed out after 10 seconds. Forcing process exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
