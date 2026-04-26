/**
 * API Routes Contract Test (Static Scan)
 *
 * Walks every app/api/**\/route.ts file and asserts:
 *   1. The file does NOT call NextResponse.json directly (use apiSuccess/apiError instead)
 *   2. The file imports either apiSuccess or apiError from @/lib/api-response
 *
 * Allow-list:
 *   k8s-style health probes follow their own convention (plain payload, non-2xx
 *   on degraded). External monitoring tools depend on these shapes.
 *
 * This is a STATIC scan — no route handlers are invoked, no DB/auth needed.
 * It runs in <100 ms and catches contract drift the moment it lands.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const API_ROOT = path.join(REPO_ROOT, 'app', 'api');

const ALLOWED_RAW_NEXT_RESPONSE = new Set<string>([
  // k8s-style health probes — external monitoring tools expect their own shapes
  'app/api/health/route.ts',
  'app/api/health/detailed/route.ts',
  'app/api/resilience/health/route.ts',
  // Binary content endpoints — return PDF, not JSON; envelope does not apply
  'app/api/pdf/invoice/[id]/route.ts',
]);

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

function rel(p: string): string {
  return path.relative(REPO_ROOT, p).replaceAll(path.sep, '/');
}

const ROUTE_FILES = listRouteFiles(API_ROOT);

describe('API routes contract — static scan', () => {
  it('discovers route files', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(50);
  });

  describe('canonical envelope usage', () => {
    for (const filePath of ROUTE_FILES) {
      const relPath = rel(filePath);
      const isAllowList = ALLOWED_RAW_NEXT_RESPONSE.has(relPath);

      it(`${relPath} ${isAllowList ? '(health-probe exception)' : 'uses canonical envelope helpers'}`, () => {
        const src = fs.readFileSync(filePath, 'utf8');

        if (isAllowList) {
          // Allow-listed files are health probes; just sanity-check they exist.
          expect(src.length).toBeGreaterThan(0);
          return;
        }

        // RULE 1 — no direct NextResponse.json
        const offending = src.match(/NextResponse\.json\s*\(/g);
        expect(
          offending,
          `${relPath} calls NextResponse.json directly (${
            offending?.length ?? 0
          } occurrence(s)). Use apiSuccess()/apiError() from @/lib/api-response instead. ` +
            `If this is a k8s-style health probe, add it to ALLOWED_RAW_NEXT_RESPONSE in tests/domain/api-routes-contract.test.ts.`
        ).toBeNull();

        // RULE 2 — imports the canonical helpers (only if file actually returns
        // something — empty/disabled stubs are fine)
        const hasReturn = /\breturn\b/.test(src);
        if (hasReturn) {
          const importsHelper =
            /from\s+['"]@\/lib\/api-response['"]/.test(src) &&
            /\b(apiSuccess|apiError|handleApiError|apiOnboardingRequired)\b/.test(src);

          expect(
            importsHelper,
            `${relPath} returns from a handler but does not import any of apiSuccess/apiError/handleApiError/apiOnboardingRequired from @/lib/api-response.`
          ).toBe(true);
        }
      });
    }
  });
});
