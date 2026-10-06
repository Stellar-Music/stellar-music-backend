import 'dotenv/config';
import { app } from './app.js';
import { initDb, getDb } from './db/database.js';
import { seedDatabase } from './db/seed.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    await initDb();
    const db = await getDb();

    // Check if initial seed is needed
    const existing = await db.queryOne('SELECT COUNT(*) as count FROM tracks');
    const count = parseInt(existing?.count || '0', 10);
    if (count === 0) {
      await seedDatabase();
    }

    app.listen(PORT, () => {
      console.log(`🎵 Stellar Music Backend running at http://localhost:${PORT}`);
      console.log(`🌐 Stellar Horizon Target: ${process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'}`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();
