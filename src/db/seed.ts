import { getDb, initDb } from './database.js';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
  await initDb();
  const db = await getDb();

  console.log('🌱 Seeding Stellar Music database...');

  // 1. Seed Artists
  const artists = [
    {
      id: 'artist-1',
      wallet_address: 'GASTRALDRIFT7777777777777777777777777777777777777777',
      display_name: 'Astral Drift',
      bio: 'Pioneering interstellar synthwave and cosmic soundscapes on the Stellar ledger.',
    },
    {
      id: 'artist-2',
      wallet_address: 'GNOVAPULSE22222222222222222222222222222222222222222',
      display_name: 'Nova Pulse',
      bio: 'Deep ambient electronic melodies crafted for late-night focused exploration.',
    },
    {
      id: 'artist-3',
      wallet_address: 'GBU7M3L62RTR6YXZZ2WOD6W7G3D7JGBWUXR7G7C3T3G2Z7C66Q4',
      display_name: 'King Taiwo',
      bio: 'Afrobeats and melodic grooves merging African rhythms with decentralized Web3 music.',
    },
  ];

  for (const a of artists) {
    await db.execute(
      `INSERT INTO artists (id, wallet_address, display_name, bio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [a.id, a.wallet_address, a.display_name, a.bio]
    );

    await db.execute(
      `INSERT INTO users (id, wallet_address, role)
       VALUES ($1, $2, 'ARTIST')
       ON CONFLICT (wallet_address) DO NOTHING`,
      [uuidv4(), a.wallet_address]
    );
  }

  // 2. Seed Tracks
  const tracks = [
    {
      id: 'track-1',
      artist_id: 'artist-1',
      title: 'Cosmic Voyage',
      description: 'An expansive voyage across the digital cosmos featuring vintage synthesizers and analog warmth.',
      audio_reference: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=cosmic-glow-110684.mp3',
      artwork_reference: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      price: 2.0, // 2 XLM
      status: 'PUBLISHED',
      genre: 'Synthwave',
      duration_seconds: 214,
    },
    {
      id: 'track-2',
      artist_id: 'artist-2',
      title: 'Midnight Nebula',
      description: 'Gentle atmospheric pads and warm sub-bass designed to elevate meditative deep work.',
      audio_reference: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-study-112191.mp3',
      artwork_reference: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
      price: 5.0, // 5 XLM
      status: 'PUBLISHED',
      genre: 'Ambient',
      duration_seconds: 182,
    },
    {
      id: 'track-3',
      artist_id: 'artist-3',
      title: 'Lagos Horizon',
      description: 'Infectious rhythmic basslines and uplifting brass celebrating Lagos street vitality.',
      audio_reference: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_8844783307.mp3?filename=summer-tropical-beat-112194.mp3',
      artwork_reference: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
      price: 3.5, // 3.5 XLM
      status: 'PUBLISHED',
      genre: 'Afrobeats',
      duration_seconds: 195,
    },
    {
      id: 'track-4',
      artist_id: 'artist-1',
      title: 'Solar Eclipse (Preview)',
      description: 'Free preview track welcoming listeners to the Stellar Music platform.',
      audio_reference: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=chill-abstract-12099.mp3',
      artwork_reference: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&auto=format&fit=crop&q=80',
      price: 0.0, // Free track
      status: 'PUBLISHED',
      genre: 'Electronic',
      duration_seconds: 160,
    },
  ];

  for (const t of tracks) {
    await db.execute(
      `INSERT INTO tracks (id, artist_id, title, description, audio_reference, artwork_reference, price, status, genre, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id,
        t.artist_id,
        t.title,
        t.description,
        t.audio_reference,
        t.artwork_reference,
        t.price,
        t.status,
        t.genre,
        t.duration_seconds,
      ]
    );
  }

  console.log('✅ Seed completed: 3 artists and 4 tracks ready.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
