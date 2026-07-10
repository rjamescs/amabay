import { test, expect } from '@playwright/test';
import { endpoints, generateBody, uniqueMarker, ItemBody } from './endpoints';
import { createItem } from './helpers';
import { ItemsEndpoint } from "./endpoints/items.endpoint";

test.describe('Items API Tests', () => {
  let Items: ItemsEndpoint;
  test.beforeEach(({request}) => {
    Items = new ItemsEndpoint(request);
  });

  // ---------------------------------------------------------------------------
  // POST /api/items — create
  // ---------------------------------------------------------------------------
  test.describe('POST /api/items', () => {
    test('creates an item (201 + Location header + timestamps)', async () => {
      const body = generateBody(endpoints.createItem)!;
      const res = await Items.createItem(body);
      // const res = await request.post(endpoints.createItem.path(), { data: body });

      expect(res.status()).toBe(201);
      const item = (await res.json()).data;
      expect(Number.isInteger(item.id)).toBe(true);
      expect(item.title).toBe((body as any).title);
      expect(item.price).toBe((body as any).price);
      expect(item.quantity).toBe((body as any).quantity);
      expect(item.created_at).toBeTruthy();
      expect(item.updated_at).toBeTruthy();
      expect(res.headers()['location']).toBe(`/api/items/${item.id}`);
    });

    test('accepts only the required fields (optional fields become null)', async () => {
      const res = await Items.createItem({ title: `Bare ${uniqueMarker()}`, price: 0, quantity: 0});
      expect(res.status()).toBe(201);
      const item = (await res.json()).data;
      expect(item.description).toBeNull();
      expect(item.image).toBeNull();
    });

    interface InvalidCase {
      describe: string;
      field: keyof ItemBody; // constrained to actual body fields, not any string
      value: unknown; // deliberately-invalid values, so allow anything
    }

    const invalidCreateCases: InvalidCase[] = [
      { describe: 'Title is number', field: 'title', value: 234343 },
      { describe: 'Title is an object', field: 'title', value: { title: '3423432' } },
      { describe: 'Price is a string', field: 'price', value: '23.33' },
      { describe: 'Price is an object', field: 'price', value: { price: '23.33' } },
      { describe: 'Price is too precise', field: 'price', value: 123.456789 },
      { describe: 'Quantity is string', field: 'quantity', value: "Five hundred" },
      { describe: 'Quantity is an object', field: 'quantity', value: { quantity: "Five hundred" } },
      { describe: 'Description is a number', field: 'description', value: 53234 },
      { describe: 'Description is an object', field: 'description', value: { description: "thing" } },
      { describe: 'Image is a number', field: 'image', value: 3234324 },
      { describe: 'Image is not a url', field: 'image', value: "placeyImage" },
      { describe: 'Image is an object', field: 'image', value: { image: "https://place.org/image.png"} },
    ];

    for (const testRow of invalidCreateCases) {
      test(testRow.describe, async () => {
        const body = generateBody(endpoints.createItem, {
          [testRow.field]: testRow.value,
        } as Partial<ItemBody>); // cast: we're intentionally violating the type
        const res = await Items.createItem(body);
        expect(res.status()).toBe(400);
        const err = (await res.json()).error;
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.correlationId).toBeTruthy();
        expect(err.details.some((d: { path?: string }) => d.path === testRow.field)).toBe(true);
      });
    }

    test('rejects a missing title (400 VALIDATION_ERROR)', async () => {
      const res = await Items.createItem({ price: 10, quantity: 1 });
      expect(res.status()).toBe(400);
      const err = (await res.json()).error;
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.correlationId).toBeTruthy();
      expect(err.details.some((d: { path?: string }) => d.path === 'title')).toBe(true);
    });

    test('rejects a negative price', async () => {
      const res = await Items.createItem(generateBody(endpoints.createItem, { price: -1 }));
      expect(res.status()).toBe(400);
      const err = (await res.json()).error;
      expect(err.details.some((d: { path?: string }) => d.path === 'price')).toBe(true);
    });

    test('rejects a non-integer quantity', async () => {
      const res = await Items.createItem(generateBody(endpoints.createItem, { quantity: 1.5 }));
      expect(res.status()).toBe(400);
      const err = (await res.json()).error;
      expect(err.details.some((d: { path?: string }) => d.path === 'quantity')).toBe(true);
    });

    test('rejects an invalid image URL', async () => {
      const res = await Items.createItem(generateBody(endpoints.createItem, { image: 'not-a-url' }));
      expect(res.status()).toBe(400);
      const err = (await res.json()).error;
      expect(err.details.some((d: { path?: string }) => d.path === 'image')).toBe(true);
    });

    test('rejects malformed JSON (400 BAD_REQUEST)', async () => {
      const res = await Items.createItem('{ "title": "oops", ', {
        headers: { 'Content-Type': 'application/json' }}); // deliberately broken JSON
      expect(res.status()).toBe(400);
      expect((await res.json()).error.code).toBe('BAD_REQUEST');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/items/:id — fetch one
  // ---------------------------------------------------------------------------
  test.describe('GET /api/items/:id', () => {
    test('returns an existing item', async ({ request }) => {
      const created = await createItem(request);
      const res = await Items.getItemById(created.id);
      expect(res.status()).toBe(200);
      const item = (await res.json()).data;
      expect(item.id).toBe(created.id);
      expect(item.title).toBe(created.title);
    });

    test('returns 404 NOT_FOUND for an unknown id', async () => {
      const res = await Items.getItemById(999999999);
      expect(res.status()).toBe(404);
      const err = (await res.json()).error;
      expect(err.code).toBe('NOT_FOUND');
      expect(err.correlationId).toBeTruthy();
    });

    test('returns 400 for a non-numeric id', async () => {
      const res = await Items.getItemById('abc');
      expect(res.status()).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/items — list / search / pagination
  //
  // A run-unique marker is embedded in each seeded title and used as the `?q=`
  // filter, so these assertions are immune to rows created by other tests /
  // parallel workers sharing the database.
  // ---------------------------------------------------------------------------
  test.describe('GET /api/items', () => {
    test('lists matching items newest-first', async ({ request }) => {
      const marker = uniqueMarker('list');
      const first = await createItem(request, { title: `First ${marker}` });
      const second = await createItem(request, { title: `Second ${marker}` });

      const res = await Items.listItems({ params: { q: marker } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.query).toBe(marker);
      expect(body.pagination.total).toBe(2);
      // Newest (highest id) first.
      expect(body.data[0].id).toBe(second.id);
      expect(body.data[1].id).toBe(first.id);
    });

    test('search matches description case-insensitively', async ({ request }) => {
      const marker = uniqueMarker('desc').toUpperCase();
      await createItem(request, { description: `contains ${marker} inside` });

      const res = await Items.listItems({
        params: { q: marker.toLowerCase() },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).pagination.total).toBe(1);
    });

    test('paginates results', async ({ request }) => {
      const marker = uniqueMarker('page');
      await createItem(request, { title: `One ${marker}` });
      await createItem(request, { title: `Two ${marker}` });
      await createItem(request, { title: `Three ${marker}` });

      const page1 = await Items.listItems({
        params: { q: marker, page: 1, pageSize: 2 },
      });
      const body1 = await page1.json();
      expect(body1.data.length).toBe(2);
      expect(body1.pagination.total).toBe(3);
      expect(body1.pagination.totalPages).toBe(2);

      const page2 = await request.get(endpoints.listItems.path(), {
        params: { q: marker, page: 2, pageSize: 2 },
      });
      expect((await page2.json()).data.length).toBe(1);
    });

    test('rejects a pageSize over the maximum', async () => {
      const res = await Items.listItems({ params: { pageSize: 1000 } });
      expect(res.status()).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/items/:id — partial update
  // ---------------------------------------------------------------------------
  test.describe('PATCH /api/items/:id', () => {
    test('applies a partial update and preserves untouched fields', async ({ request }) => {
      const created = await createItem(request);
      const res = await Items.updateItemById(created.id, generateBody(endpoints.updateItem, { price: 149.99 }));
      expect(res.status()).toBe(200);
      const item = (await res.json()).data;
      expect(item.price).toBe(149.99);
      expect(item.title).toBe(created.title); // untouched
      expect(item.created_at).toBe(created.created_at);
      expect(item.updated_at >= created.created_at).toBe(true);
    });

    test('returns 404 for an unknown id', async () => {
      const res = await Items.updateItemById(999999999, generateBody(endpoints.updateItem));
      expect(res.status()).toBe(404);
      expect((await res.json()).error.code).toBe('NOT_FOUND');
    });

    test('rejects an empty body', async ({ request }) => {
      const created = await createItem(request);
      const res = await Items.updateItemById(created.id, {} );
      expect(res.status()).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid values', async ({ request }) => {
      const created = await createItem(request);
      const res = await Items.updateItemById(created.id, generateBody(endpoints.updateItem, { price: -10 }));
      expect(res.status()).toBe(400);
      const err = (await res.json()).error;
      expect(err.details.some((d: { path?: string }) => d.path === 'price')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/items/:id
  // ---------------------------------------------------------------------------
  test.describe('DELETE /api/items/:id', () => {
    test('deletes an item (204) then 404 on re-fetch', async ({ request }) => {
      const created = await createItem(request);

      const del = await Items.deleteItemById(created.id);
      expect(del.status()).toBe(204);

      const get = await Items.getItemById(created.id);
      expect(get.status()).toBe(404);
    });

    test('returns 404 for an unknown id', async () => {
      const res = await Items.deleteItemById(999999999);
      expect(res.status()).toBe(404);
      expect((await res.json()).error.code).toBe('NOT_FOUND');
    });
  });
});


// ---------------------------------------------------------------------------
// Unmatched routes
// ---------------------------------------------------------------------------
test('unknown routes return a 404 envelope', async ({ request }) => {
  const res = await request.get('/api/does-not-exist');
  expect(res.status()).toBe(404);
  expect((await res.json()).error.code).toBe('NOT_FOUND');
});
