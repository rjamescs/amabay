import { test, expect } from '@playwright/test';
import { HealthEndpoint } from './endpoints/health.endpoint';

test.describe('GET /health', () => {
  let Health: HealthEndpoint;
  test.beforeEach(async ({request}) => {
    Health = new HealthEndpoint(request);
  });

  test('returns ok with a timestamp', async () => {
    const res = await Health.get();
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.time).toBe('string');
    // Every response carries a correlation id header.
    expect(res.headers()['x-correlation-id']).toBeTruthy();
  });

  test('echoes an inbound X-Correlation-ID', async () => {
    const cid = 'e2e-fixed-correlation-id';
    const res = await Health.get({
        headers: {'X-Correlation-ID': cid},
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['x-correlation-id']).toBe(cid);
  });
});
