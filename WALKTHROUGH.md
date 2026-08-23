# Technical Architecture & Walkthrough — Document Vault GraphQL API

A clean, production-minded backend GraphQL service for organizing documents into collections, built with **Bun**, **TypeScript** (strict mode, no `any`), **GraphQL Yoga**, **PostgreSQL**, and **Prisma**.

---

## 1. Executive Summary

This repository implements a schema-first GraphQL API engineered for document management. It features custom typed GraphQL errors, strict input validation, N+1 query prevention, cursor-based pagination, case-insensitive substring searching, comprehensive unit/integration test suites, and multi-environment support (Local Docker Compose, Cloud PostgreSQL, and Vercel Serverless).

---

## 2. Directory & Project Structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions automated test & lint workflow
├── api/
│   └── graphql.ts              # Vercel serverless function entrypoint
├── prisma/
│   ├── schema.prisma           # Prisma data models & datasource configuration
│   └── migrations/             # Automatically generated SQL migrations
├── src/
│   ├── schema/
│   │   ├── schema.graphql      # Source of truth GraphQL SDL schema
│   │   └── sdl.ts              # Inlined SDL string export for serverless bundling
│   ├── resolvers/
│   │   ├── collection.ts       # Collection queries, mutations, & document relation resolvers
│   │   ├── document.ts         # Document queries (search/pagination), mutations, & back-resolvers
│   │   └── index.ts            # Root resolver merger
│   ├── validation/
│   │   └── rules.ts            # Pure validation logic (slug format, title, content, existence)
│   ├── errors.ts               # Custom GraphQLError classes (ValidationError, NotFoundError)
│   ├── context.ts              # Per-request context builder
│   ├── db.ts                   # PrismaClient singleton with globalThis serverless caching
│   └── server.ts               # GraphQL Yoga server instance & dev entrypoint
├── tests/
│   ├── setupIntegration.ts     # Isolated integration test DB harness
│   ├── unit/
│   │   ├── validation.test.ts  # Unit tests for validation functions
│   │   └── resolvers.test.ts   # Unit tests for resolvers with mocked Prisma Client
│   └── integration/
│       └── api.test.ts         # End-to-end integration tests against PostgreSQL
├── Dockerfile                  # Multi-stage Bun production container image
├── docker-compose.yml          # Local PostgreSQL container service
├── eslint.config.js            # ESLint 9 flat configuration
├── tsconfig.json               # Strict TypeScript configuration
├── package.json                # Dependencies, scripts, and Vercel build config
└── README.md                   # Quick start & API documentation
```

---

## 3. Data Domain & Prisma Schema

The core domain model is defined strictly in `prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Collection {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique
  createdAt DateTime   @default(now())
  documents Document[]
}

model Document {
  id           String     @id @default(cuid())
  title        String
  content      String
  tags         String[]
  isArchived   Boolean    @default(false)
  createdAt    DateTime   @default(now())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id])

  @@index([collectionId])
}
```

### Key Schema Design Features:
- **Collision-Resistant CUIDs**: Primary keys use `cuid()` for URL-safe, time-sortable unique IDs.
- **Unique Slugs**: `Collection.slug` is enforced unique at database level.
- **Indexed FKs**: `Document.collectionId` is explicitly indexed (`@@index([collectionId])`) for fast relational lookup performance.

---

## 4. Schema-First GraphQL Design

The API definition lives in `src/schema/schema.graphql` as the contract:

```graphql
type Collection {
  id: ID!
  name: String!
  slug: String!
  createdAt: String!
  documents: [Document!]!
}

type Document {
  id: ID!
  title: String!
  content: String!
  tags: [String!]!
  isArchived: Boolean!
  createdAt: String!
  collectionId: ID!
  collection: Collection!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: ID
  endCursor: ID
}

type DocumentEdge {
  cursor: ID!
  node: Document!
}

type DocumentConnection {
  edges: [DocumentEdge!]!
  nodes: [Document!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type Query {
  collections: [Collection!]!
  collection(id: ID!): Collection
  documents(
    collectionId: ID
    search: String
    isArchived: Boolean
    take: Int = 20
    cursor: ID
  ): DocumentConnection!
}

type Mutation {
  createCollection(name: String!, slug: String!): Collection!
  createDocument(
    title: String!
    content: String!
    tags: [String!]
    collectionId: ID!
  ): Document!
  updateDocument(
    id: ID!
    title: String
    content: String
    tags: [String!]
    isArchived: Boolean
  ): Document!
  deleteDocument(id: ID!): Boolean!
  moveDocument(id: ID!, collectionId: ID!): Document!
}
```

---

## 5. Input Validation & Error Handling Architecture

Instead of allowing unhandled 500 runtime errors, validation executes **before** any database operation.

### Custom Typed Errors (`src/errors.ts`)
```ts
export class ValidationError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: "VALIDATION_ERROR" } });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: "NOT_FOUND" } });
  }
}
```

### Validation Rules (`src/validation/rules.ts`)
- **Slug Format**: Strictly validates kebab-case formatting (`/^[a-z0-9]+(-[a-z0-9]+)*$/`).
- **Non-Empty String Checks**: Rejects empty strings and whitespace-only strings for titles and contents.
- **Tag Normalization**: Trims tag strings and strips empty elements.
- **Existence Checks**: Verifies `collectionId` and `documentId` exist in PostgreSQL before executing creation, update, or move operations, throwing `NotFoundError` (`NOT_FOUND`) if missing.

---

## 6. Resolver Implementation Highlights

### A. Substring Search & Case-Insensitivity
The `documents` resolver performs case-insensitive substring searching over both `title` OR `content` using Prisma's `{ contains: search, mode: "insensitive" }`.

### B. Cursor-Based Pagination
Pagination is implemented natively on `Document.id`:
- `cursor: { id: cursor }` with `skip: 1` modifier.
- Queries `take: limit + 1` to efficiently calculate `hasNextPage` without extra DB overhead.

### C. Relational Field Resolvers & N+1 Avoidance
- `Collection.documents`: If `parent.documents` is already pre-fetched by Prisma, returns it directly; otherwise queries `documents` scoped by `collectionId`.
- `Document.collection`: Back-resolver resolving the parent collection.

---

## 7. Testing Strategy

The repository includes a two-tiered testing setup:

1. **Unit Tests (`bun run test`)**:
   - `tests/unit/validation.test.ts`: Pure unit tests for `validateSlug`, `validateTitle`, `validateContent`, `normalizeTags`.
   - `tests/unit/resolvers.test.ts`: Tests resolvers using a mocked Prisma Client instance.

2. **Integration Tests (`bun run test:integration`)**:
   - `tests/integration/api.test.ts`: Runs GraphQL operations (`createCollection` → `createDocument` → `moveDocument` → `documents search/pagination`) against an isolated PostgreSQL instance (`TEST_DATABASE_URL`).

3. **Sanity Pipeline (`bun run sanity`)**:
   Chains `lint` → `typecheck` → `unit tests` → `integration tests` in a single command.

---

## 8. Deployment Architecture

- **Local Development**: PostgreSQL container via `docker-compose.yml`, Bun runtime watching `src/server.ts`.
- **Production Container**: Dockerfile built with `oven/bun:1`.
- **Vercel Serverless**: Configured with `api/graphql.ts` serverless handler, `globalThis` Prisma singleton, and Neon Cloud PostgreSQL (`?sslmode=require`).

---

## 9. Design Tradeoffs & Future Extensions

- **Cursor Encoding**: Raw `Document.id` strings are used as transparent cursors rather than base64 Relay opaque strings for clean simplicity.
- **Pure Functions vs. Zod**: Plain TypeScript validation functions keep bundle size minimal.
- **Hard Delete**: `deleteDocument` performs a hard delete since `isArchived` serves non-destructive hiding.
- **Future Scale**:
  - Add JWT authentication (`Context.userId`).
  - Add `DataLoader` for batching nested resolvers at scale.
  - Upgrade substring search to Postgres `tsvector` full-text search.
