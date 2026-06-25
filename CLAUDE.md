# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev      # Development server with watch mode (port 3001)
npm run build          # Compile TypeScript to dist/
npm run start:prod     # Run production build
npm run lint           # ESLint with auto-fix
npm run test           # Unit tests (Jest)
npm run test:watch     # Unit tests in watch mode
npm run test:cov       # Tests with coverage
npm run test:e2e       # End-to-end tests
```

Run a single test file:
```bash
npx jest src/clients/clients.service.spec.ts
```

## Architecture

**PiwiSystem** is a logistics/route-planning REST API. The primary workflow: clients create orders → orders are assigned to trips → trips have sequential stops (TripStops) with pickup/delivery points → routes store GeoJSON map data for trips → drivers are assigned to trips.

### Database

Uses **Microsoft SQL Server** via the `mssql` driver directly — no ORM (no TypeORM, no Prisma). The connection is provided as a NestJS injection token `DATABASE_CONNECTION` (a `mssql.ConnectionPool`). All services receive this via `@Inject('DATABASE_CONNECTION')` and write raw parameterized SQL queries.

Connection config is hardcoded in `src/database/database.providers.ts` targeting `RODRIGO-PC\SQLEXPRESS02 / PiwiDB`. SQL migration scripts live in `sql/`.

### Auth

JWT-based. `POST /auth/login` accepts username/password (Local Strategy), returns a Bearer token. All other routes should be guarded with `@UseGuards(JwtAuthGuard)`. JWT secret comes from `JWT_SECRET` in `.env`, expiration is 2 hours.

The user store is a **hardcoded in-memory object** in `auth.service.ts` (username `admin`, password hashed with bcrypt) — there is no users table. This is intentionally temporary.

### Module Pattern

Every feature module follows the same structure:
```
src/[feature]/
├── [feature].module.ts       # imports DatabaseModule
├── [feature].service.ts      # injects DATABASE_CONNECTION, runs SQL
├── [feature].controller.ts   # REST endpoints, uses DTOs
├── [feature].interface.ts    # TypeScript interface for the entity
└── dto/
    ├── create-[feature].dto.ts
    └── update-[feature].dto.ts
```

Modules are fully independent — they do not import each other. Cross-entity relationships (e.g., orders linked to trips) are managed exclusively through SQL foreign keys and the `order-trip` junction module.

### Key Modules

| Module | Route prefix | Notes |
|---|---|---|
| `clients` | `/clients` | Full CRUD |
| `orders` | `/orders` | Status: `pendiente` / `en tránsito` / `entregado` |
| `drivers` | `/drivers` | `licenseNumber` has unique index |
| `trips` | `/trips` | Status: `scheduled` / `in_transit` / `delivered` / `canceled`; FK to drivers |
| `order-trip` | `/order-trip` | Junction table; extra endpoints: `GET order/:orderId`, `GET trip/:tripId` |
| `trip-stops` | `/trip-stops` | Ordered delivery stops; extra endpoint: `GET trip/:tripId` |
| `routes` | `/routes` | Stores `routeGeoJson` and `pdfUrl` for a trip |
| `auth` | `/auth` | `POST /login` only |

### SQL naming and schema notes

- The junction table is named `Order_Trip` in SQL (not `OrderTrip`). Its service queries use this exact name.
- The `Trips` table has legacy `vehicle` and `driver` (NVARCHAR) columns that are always inserted as `NULL`. The canonical driver reference is `driverId` (FK to `Drivers`).
- `TripStops` has a `UNIQUE` index on `(tripId, sequence)` — sequence numbers must be unique per trip. `TripStops` also cascades deletes from `Trips`.
- Date handling in `Trips`: a single ISO datetime string from the client is split into `tripDate` (date-only) and `departureTime` (full datetime2). Queries use `COALESCE(departureTime, CAST(tripDate AS datetime2))` as the display date.
- Dynamic UPDATE pattern: services for `Orders`, `TripStops`, and `Trips` build the SET clause at runtime from the keys present in the DTO. Empty-patch calls (no keys) are silently ignored or return early.

### Validation

Global `ValidationPipe` is registered in `main.ts` with `whitelist: true` and `transform: true`. DTOs use `class-validator` decorators — all endpoint inputs are validated automatically.
