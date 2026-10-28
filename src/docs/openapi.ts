import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

export const docsRouter = Router();

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Stellar Music Core API',
    version: '1.2.0',
    description:
      'Decentralized audio streaming platform on Stellar & Soroban. Provides cryptographic access passes, non-custodial streaming accounting, and automated multi-party revenue settlements.',
    contact: {
      name: 'KingTaiwoDev',
      url: 'https://github.com/Stellar-Music',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development server',
    },
    {
      url: 'https://api.music.stellar.org',
      description: 'Production API gateway',
    },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'System health probe',
        tags: ['System'],
        responses: {
          '200': {
            description: 'API is healthy and operational',
          },
        },
      },
    },
    '/api/health/db': {
      get: {
        summary: 'Database connectivity probe',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Database connection verified',
          },
        },
      },
    },
    '/api/health/stellar': {
      get: {
        summary: 'Stellar Horizon network connectivity probe',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Horizon RPC reachable',
          },
        },
      },
    },
    '/api/tracks': {
      get: {
        summary: 'List available audio tracks',
        tags: ['Tracks'],
        parameters: [
          { name: 'genre', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Array of track metadata records' },
        },
      },
      post: {
        summary: 'Publish a new audio track',
        tags: ['Tracks'],
        responses: {
          '201': { description: 'Track successfully created' },
        },
      },
    },
    '/api/passes': {
      get: {
        summary: 'List passes by wallet or track',
        tags: ['Passes'],
        parameters: [
          { name: 'wallet', in: 'query', schema: { type: 'string' } },
          { name: 'track_id', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of confirmed access passes' },
        },
      },
      post: {
        summary: 'Record and verify Stellar pass purchase',
        tags: ['Passes'],
        responses: {
          '201': { description: 'Pass verified on ledger and granted' },
        },
      },
    },
    '/api/settlements': {
      get: {
        summary: 'List verified on-chain settlements',
        tags: ['Settlements'],
        responses: {
          '200': { description: 'Settlement execution history' },
        },
      },
    },
    '/api/settlements/export': {
      get: {
        summary: 'Export settlements history as CSV',
        tags: ['Settlements'],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', default: 'csv' } },
        ],
        responses: {
          '200': {
            description: 'CSV file download of settlement history',
            content: { 'text/csv': {} },
          },
        },
      },
    },
    '/api/revenue/pending': {
      get: {
        summary: 'Get pending unsettled revenue summary',
        tags: ['Settlements'],
        parameters: [
          { name: 'wallet', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Pending revenue allocations' },
        },
      },
    },
  },
};

// Serve raw JSON spec
docsRouter.get('/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

// Serve interactive Swagger UI
docsRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
