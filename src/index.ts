import 'dotenv/config';
import { app } from './app.js';
import { initDb, getDb } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { env } from './config/env.js';
import { setupGracefulShutdown } from './utils/shutdown.js';

const PORT = env.PORT;

async function bootstrap() {
  try {
    await initDb();
    const db = await getDb();

    // Check if initial seed is needed
    const existing = await db.queryOne<{ count: string | number }>('SELECT COUNT(*) as count FROM tracks');
    const count = parseInt(String(existing?.count || '0'), 10);
    if (count === 0) {
      await seedDatabase();
    }

    const server = app.listen(PORT, () => {
      console.log(`🎵 Stellar Music Backend running at http://localhost:${PORT}`);
      console.log(`🌐 Stellar Horizon Target: ${env.HORIZON_URL}`);
      console.log(`📚 Interactive Swagger API Docs at http://localhost:${PORT}/api/docs`);
    });

    setupGracefulShutdown(server);
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();
