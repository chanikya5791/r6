# ShopLite Users API (r6)

Sign-up, login and user management for ShopLite. Stores users in **PostgreSQL** and issues **JWTs** (HS256)
that the Orders API (r2) and Catalog API (r3) accept. Part of the ShopLite test app; see the
[infra repo (r5)](../r5) for the whole system.

## Endpoints

Full contract: [`openapi.yaml`](openapi.yaml).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | `{status, checks: {postgres}}`; 503 if the database is down |
| POST | `/auth/register` | none | `{email, password, name}` → 201 user. Email is lower-cased and must be unique (409). Password is 8–72 characters. Always creates a `customer`. |
| POST | `/auth/login` | none | `{email, password}` → `{token, tokenType, expiresIn, user}`. 401 with the same message for a wrong password or an unknown email. |
| GET | `/users/me` | any user | The logged-in user |
| GET | `/users?page=&limit=` | admin | Paged list |
| GET | `/users/:id` | admin, or the user themself | 403 for other users, 404 for unknown ids |

Errors always look like `{"error": {"code", "message", "details?"}}`. Codes: `VALIDATION_ERROR`, `INVALID_JSON`,
`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`. Every response has an `X-Request-Id` header (an incoming
one is reused).

On start-up the service creates its table and an admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if it does
not exist.

## Run

```bash
cp .env.example .env     # point DATABASE_URL at a Postgres database
npm ci
npm run dev              # or: npm run build && npm start
```

Or run the whole system with `make up` in r5.

| Variable | Default |
|---|---|
| `PORT` | `3001` |
| `DATABASE_URL` | `postgres://shoplite:shoplite@localhost:5432/users` |
| `JWT_SECRET` | `dev-secret-change-me` (must match r2 and r3) |
| `JWT_EXPIRES_IN` | `1h` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@shoplite.local` / `Admin123!` |

## Tests

```bash
npm run test:unit          # JWT middleware, validation, config
npm run test:integration   # real Postgres via Testcontainers (needs Docker)
npm test                   # both
```

The integration tests run the real app against Postgres and check every response against `openapi.yaml`. They
cover registration, duplicates, validation, login, role checks, paging and 404s.
