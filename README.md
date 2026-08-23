# Document Vault — GraphQL API

A small backend service for organizing documents into collections, built with **Bun**, **TypeScript** (strict, no `any`), **GraphQL Yoga**, **PostgreSQL**, and **Prisma**.

This was built as a take-home assignment. The scope is intentionally narrow — no auth, no RBAC, no federation, no caching layer, no deployment config — in favor of a clean, well-tested implementation of the required domain.

---

## Quick start

Requirements: [Bun](https://bun.sh) ≥ 1.1, Docker + Docker Compose.

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

This will:
1. Start PostgreSQL in a container (`docker compose up -d`)
2. Install dependencies (`bun install`)
3. Run Prisma migrations + generate the client against the running DB (`bun run gendb`)
4. Start the GraphQL Yoga server in watch mode (`bun run dev`)

The GraphiQL playground will be available at **http://localhost:4000/graphql**.

### Environment variables

Copy `.env.example` to `.env` before the first run:

```bash
cp .env.example .env
```

| Variable            | Default                                                         | Purpose                                   |
|---------------------|-----------------------------------------------------------------|-------------------------------------------|
| `DATABASE_URL`      | `postgresql://vault:vault@localhost:5432/vault?schema=public`   | Prisma main connection string             |
| `TEST_DATABASE_URL` | `postgresql://vault:vault@localhost:5432/vault_test?schema=public` | Isolated integration test database URL    |
| `PORT`              | `4000`                                                          | GraphQL Yoga server port                  |

---

## Scripts

| Command                   | Description                                                      |
|---------------------------|------------------------------------------------------------------|
| `bun run dev`             | Start the server in watch mode                                   |
| `bun run gendb`           | Run `prisma migrate dev` + `prisma generate`                     |
| `bun run migrate`         | Alias for `prisma migrate dev` (creates a new migration)          |
| `bun run lint`            | ESLint 9 flat config over `src/`                                 |
| `bun run typecheck`       | `tsc --noEmit` in strict mode                                    |
| `bun run test`            | Unit tests (resolvers, validation) — mocked Prisma client        |
| `bun run test:integration` | Integration tests against isolated Dockerized Postgres instance  |
| `bun run sanity`          | Runs lint → typecheck → unit tests → integration tests, in order |

---

## Project structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions pipeline
├── docker-compose.yml
├── Dockerfile
├── init-test-db.sql
├── prisma/
│   ├── schema.prisma
│   └── migrations/            # generated via `prisma migrate dev`, never hand-edited
├── src/
│   ├── schema/
│   │   └── schema.graphql     # SDL — source of truth for the API shape
│   ├── resolvers/
│   │   ├── collection.ts
│   │   ├── document.ts
│   │   └── index.ts
│   ├── validation/
│   │   └── rules.ts           # slug format, title/content/tags & existence checks
│   ├── errors.ts              # typed GraphQLError subclasses (ValidationError, NotFoundError)
│   ├── context.ts             # per-request context (Prisma client)
│   ├── db.ts                  # PrismaClient singleton
│   └── server.ts              # Yoga server entrypoint
├── tests/
│   ├── setupIntegration.ts    # Test DB helper & reset cleanup
│   ├── unit/
│   │   ├── validation.test.ts
│   │   └── resolvers.test.ts
│   └── integration/
│       └── api.test.ts
├── .env.example
├── eslint.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## Domain model

```prisma
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

All schema changes are made through `bun run migrate` (`prisma migrate dev --name <change>`) and committed under `prisma/migrations/`. No hand-written SQL migrations.

---

## API overview

Schema-first: `src/schema/schema.graphql` is the source of truth, resolvers in `src/resolvers/` implement it.

### Queries

```graphql
collections: [Collection!]!

collection(id: ID!): Collection

documents(
  collectionId: ID
  search: String
  isArchived: Boolean
  take: Int = 20
  cursor: ID
): DocumentConnection!
```

- `collection(id)` returns the collection with its nested `documents` resolved via Prisma relation.
- `documents(search: ...)` performs case-insensitive substring matching against `title` OR `content` (`contains`, `mode: "insensitive"`).
- Pagination is cursor-based: pass `take` and, for subsequent pages, the `endCursor` (transparent `Document.id`) from the previous page's `pageInfo`.

### Mutations

```graphql
createCollection(name: String!, slug: String!): Collection!
createDocument(title: String!, content: String!, tags: [String!], collectionId: ID!): Document!
updateDocument(id: ID!, title: String, content: String, tags: [String!], isArchived: Boolean): Document!
deleteDocument(id: ID!): Boolean!
moveDocument(id: ID!, collectionId: ID!): Document!
```

---

## Validation & error handling

Input validation happens before any DB write and returns real GraphQL errors (with an `extensions.code`), not unhandled 500s:

| Rule                                      | Error code           |
|-------------------------------------------|----------------------|
| Empty/whitespace-only title               | `VALIDATION_ERROR`   |
| Empty/whitespace-only content             | `VALIDATION_ERROR`   |
| Slug not `^[a-z0-9]+(-[a-z0-9]+)*$`       | `VALIDATION_ERROR`   |
| Referencing a non-existent `collectionId`  | `NOT_FOUND`          |
| Referencing a non-existent document `id`   | `NOT_FOUND`          |

Validation rules live in `src/validation/rules.ts` and are unit-tested independently of any resolver/DB wiring.

---

## Testing

- **Unit tests** (`bun run test`): resolvers tested against a mocked Prisma client, plus standalone tests for validation rules. Fast, no Docker dependency.
- **Integration tests** (`bun run test:integration`): run against an isolated database (`TEST_DATABASE_URL`) in the Dockerized Postgres instance, covering create → move → query-by-collection, and the search/filter/pagination path end-to-end.
- `bun run sanity` chains lint → typecheck → unit → integration, so CI (or a reviewer) can run one command.

---

## Tradeoffs

- **Nested `collection.documents` & `document.collection` resolution**: resolved directly via targeted Prisma relation queries to avoid N+1 issues without introducing a DataLoader dependency for this scope.
- **`Document.collection` back-resolver**: Included as an intentional extra for GraphQL schema completeness.
- **Cursor pagination**: Implemented using raw `Document.id` as transparent cursors with Prisma's native `cursor: { id }` + `skip: 1` pattern.
- **Validation**: Written as pure TypeScript validation functions rather than adding a external schema validation library (e.g. Zod), keeping dependencies minimal.
- **Hard delete**: `deleteDocument` performs a hard delete. Since `isArchived` handles non-destructive hiding, a separate soft-delete flag was excluded.

## Out of scope (by design)

Authentication/authorization, GraphQL Federation, caching (Redis or otherwise), and deployment tooling were explicitly excluded per the assignment brief.

## How I'd extend this

- Add auth (JWT + `Context.userId`) and scope collections/documents to an owner.
- Add `DataLoader` per-request if nested resolution patterns grow deeper.
- Upgrade substring `ILIKE` search to Postgres full-text search (`tsvector`) if document size or search traffic increases.
- Add optimistic concurrency (`updatedAt` + version field) on mutations if multi-writer conflicts occur.

---

## Bonus items included

- [x] `bun run sanity` — lint + typecheck + unit + integration in one command
- [x] `Dockerfile` for the service
- [x] GitHub Actions workflow (`.github/workflows/ci.yml`) running lint + tests on PR open
