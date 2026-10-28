# Contributing to Stellar Music Backend

Thank you for contributing to the **Stellar Music Backend & Streaming Service**!

## Code of Conduct
Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Prerequisites
- **Node.js**: v20+ (v22/v25 recommended)
- **npm**: v10+
- **PostgreSQL**: v14+ (or Docker Compose)

## Setup & Development
1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Run tests:
   ```bash
   npm test
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

## Commit Standards
Follow the Conventional Commits specification:
- `feat(api): ...`
- `fix(streaming): ...`
- `test(settlement): ...`
- `docs(backend): ...`

## Pull Request Process
1. Ensure all TypeScript types compile (`npm run build`).
2. Run test suites (`npm test`).
3. Detail the endpoints and changes made in your PR description.
