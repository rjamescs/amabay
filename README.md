# amabay — Simple Ecommerce Items API

A small, runnable REST API for managing ecommerce catalog **items**, built with
**Node.js + TypeScript + Express** and a file-based **SQLite** database. No
auth — every endpoint is open. Images are stored as a URL string (no file
upload).

> **Driver note:** The original stack called for `better-sqlite3`. On the
> target machine (Node 26, no Python/MSVC build tools) it has no prebuilt binary
> and cannot compile. Node 26 ships a stable built-in SQLite module
> (`node:sqlite`) that gives the same file-based, synchronous, prepared-statement
> model with zero native-build requirement, so the app runs on that instead.
> The driver is isolated in `src/db/index.ts` behind a small
> better-sqlite3-shaped adapter, so switching back is a one-file change. See
> "Decisions" at the bottom.

## Features

- Create, read, update (partial), delete items
- Text search across `title` + `description` with pagination
- List-all and get-by-id
- Zod input validation with standardized JSON error responses
- Correlation ids (`X-Correlation-ID`) on every request/response
- Schema init + sample seed run automatically on startup

## Requirements

- **Node.js 24+** (uses the stable built-in `node:sqlite` module; developed on
  Node 26). No native build tools required.
- npm

## Setup & run

```powershell
npm install        # install dependencies
npm run dev        # start in watch mode on http://localhost:3000
```

Other scripts:

```powershell
npm run build      # compile TypeScript to dist/
npm start          # run the compiled server (node dist/server.js)
npm run typecheck  # type-check without emitting
```

Configuration via environment variables (all optional):

| Var       | Default                   | Purpose                              |
|-----------|---------------------------|--------------------------------------|
| `PORT`    | `3000`                    | HTTP port                            |
| `DB_FILE` | `./data/amabay.sqlite`    | SQLite file path                     |
| `SEED`    | `true`                    | Seed 2 sample items on first run     |

## Data model

An **Item**:

| Field        | Type    | Rules                        |
|--------------|---------|------------------------------|
| `id`         | integer | auto-generated PK            |
| `title`      | string  | required, 1–200 chars        |
| `price`      | number  | required, `>= 0`             |
| `quantity`   | integer | required, `>= 0`             |
| `description`| string  | optional, ≤ 5000 chars       |
| `image`      | string  | optional, valid URL ≤ 2048   |
| `created_at` | string  | ISO-8601 UTC, auto           |
| `updated_at` | string  | ISO-8601 UTC, auto           |

## Response envelopes

Success (single): `{ "data": { ...item } }`
Success (list):   `{ "data": [ ... ], "pagination": { page, pageSize, total, totalPages }, "query": "..." }`

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "price", "message": "price must be >= 0" }],
    "correlationId": "..."
  }
}
```

## Endpoints & example requests

Base URL: `http://localhost:3000`

### HealthEndpoint
```bash
curl http://localhost:3000/health
```

### Create an item — `POST /api/items`
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mechanical Keyboard",
    "price": 89.99,
    "quantity": 25,
    "description": "Hot-swappable 75% keyboard with RGB.",
    "image": "https://example.com/keyboard.jpg"
  }'
# -> 201 Created, { "data": { "id": 3, ... } }
```

### List / search — `GET /api/items`
```bash
# List all (newest first), default pagination
curl "http://localhost:3000/api/items"

# Text search + pagination
curl "http://localhost:3000/api/items?q=keyboard&page=1&pageSize=10"
# -> 200 OK, { "data": [...], "pagination": {...}, "query": "keyboard" }
```

### Get by id — `GET /api/items/:id`
```bash
curl "http://localhost:3000/api/items/1"
# -> 200 OK or 404 NOT_FOUND
```

### Update (partial) — `PATCH /api/items/:id`
```bash
curl -X PATCH http://localhost:3000/api/items/1 \
  -H "Content-Type: application/json" \
  -d '{ "price": 179.99, "quantity": 40 }'
# -> 200 OK with the updated item
```

### Delete — `DELETE /api/items/:id`
```bash
curl -X DELETE http://localhost:3000/api/items/1
# -> 204 No Content, or 404 NOT_FOUND
```

## Project layout

```
src/
  config.ts                     # env-driven runtime config
  server.ts                     # bootstrap: migrate + listen
  app.ts                        # express app assembly
  errors.ts                     # ApiError + error taxonomy
  db/
    index.ts                    # better-sqlite3 connection (WAL)
    migrate.ts                  # idempotent schema init + seed
  middleware/
    correlationId.ts            # X-Correlation-ID per request
    errorHandler.ts             # standardized error envelope + 404
  repositories/
    itemRepository.ts           # prepared-statement data access
  routes/
    items.ts                    # /api/items router
  validation/
    item.ts                     # zod schemas / API contract
```

## Search implementation note

Search uses case-insensitive `LIKE '%q%'` across `title` and `description`,
backed by `COLLATE NOCASE` indexes. LIKE wildcards in user input are escaped.
This is simple and dependency-free. Substring (`%q%`) matches cannot use the
index (only prefix matches can), so for very large catalogs the recommended
upgrade is SQLite **FTS5** with a synced virtual table — noted but intentionally
out of scope for this "simple" build.
