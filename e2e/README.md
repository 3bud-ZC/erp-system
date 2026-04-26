# E2E Tests (Playwright)

End-to-end smoke tests for critical user flows. **Read-only against existing app behavior** — write tests use unique time-stamped codes to avoid collisions.

## Prerequisites

1. **Database reachable** with `DATABASE_URL` set in `.env`.
2. **Admin user seeded.** Run once:
   ```bash
   npx tsx prisma/seed-auth.ts
   ```
   This creates `admin@erp.com / admin` (matches the login page placeholder).
3. **Browser binaries:** `npx playwright install chromium` (one-time).

## Running

### Option A — manual server (recommended for local dev)
```bash
# terminal 1
npm run dev

# terminal 2
npm run e2e
```

### Option B — auto-start server
```bash
E2E_AUTO_SERVER=1 npm run e2e
```

### Useful flags
```bash
npm run e2e -- --headed              # watch the browser
npm run e2e -- --ui                  # interactive runner
npm run e2e -- e2e/auth/login.spec.ts  # single file
npm run e2e -- --debug               # step-through debugger
```

## Configuration

Override defaults via env vars:

| Var | Default | Purpose |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | App URL |
| `E2E_EMAIL` | `admin@erp.com` | Test user email |
| `E2E_PASSWORD` | `admin` | Test user password |
| `E2E_AUTO_SERVER` | _unset_ | Set to `1` to auto-spawn `next dev` |

## Layout

```
e2e/
  global.setup.ts         # logs in once, saves storageState to .auth/admin.json
  fixtures/credentials.ts # central env-driven creds
  auth/login.spec.ts      # login page smoke + redirect
  customers/customers.spec.ts
  inventory/products.spec.ts
  sales/invoices.spec.ts
  accounting/journal.spec.ts
  .auth/                  # gitignored — generated storageState
```

## Test data hygiene

- Each create-flow uses `Date.now()` in entity codes (e.g. `CUS-1714123456789`) so reruns don't collide.
- Tests **do not delete** what they create (kept simple per "tests must run against existing behavior"). Run `npm run db:reset` if test data accumulates.

## Stop conditions (per Phase 5 spec)

If any test fails, stop and report rather than mass-fixing. Each test file is independently revertable: `git checkout HEAD~1 -- e2e/<path>`.
