import { before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getTestContext, resetDb } from './setup';

let app: import('express').Express;
let db: { exec(sql: string): void };

before(async () => {
  const ctx = await getTestContext();
  app = ctx.app;
  db = ctx.db;
});

// Each test starts from an empty table — no dependence on ordering or seed data.
beforeEach(() => {
  resetDb(db);
});

const validItem = {
  title: 'Mechanical Keyboard',
  price: 89.99,
  quantity: 25,
  description: 'Hot-swappable 75% keyboard',
  image: 'https://example.com/kb.jpg',
};

// Helper: create an item and return the created record.
async function createItem(overrides: Partial<typeof validItem> = {}) {
  const res = await request(app)
    .post('/api/items')
    .send({ ...validItem, ...overrides });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

// ---------------------------------------------------------------------------
// HealthEndpoint
// ---------------------------------------------------------------------------
test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.ok(typeof res.body.time === 'string');
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
test('POST /api/items creates an item (201 + Location + timestamps)', async () => {
  const res = await request(app).post('/api/items').send(validItem);
  assert.equal(res.status, 201);
  const item = res.body.data;
  assert.ok(Number.isInteger(item.id));
  assert.equal(item.title, validItem.title);
  assert.equal(item.price, validItem.price);
  assert.equal(item.quantity, validItem.quantity);
  assert.equal(item.description, validItem.description);
  assert.equal(item.image, validItem.image);
  assert.ok(item.created_at);
  assert.ok(item.updated_at);
  assert.equal(res.headers.location, `/api/items/${item.id}`);
});

test('POST /api/items works with only required fields', async () => {
  const res = await request(app)
    .post('/api/items')
    .send({ title: 'Bare', price: 0, quantity: 0 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.description, null);
  assert.equal(res.body.data.image, null);
});

test('POST /api/items rejects missing title (400)', async () => {
  const res = await request(app)
    .post('/api/items')
    .send({ price: 10, quantity: 1 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.correlationId);
  assert.ok(res.body.error.details.some((d: { path?: string }) => d.path === 'title'));
});

test('POST /api/items rejects empty title (400)', async () => {
  const res = await request(app)
    .post('/api/items')
    .send({ title: '', price: 10, quantity: 1 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/items rejects negative price (400)', async () => {
  const res = await request(app)
    .post('/api/items')
    .send({ title: 'X', price: -1, quantity: 1 });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some((d: { path?: string }) => d.path === 'price'));
});

test('POST /api/items rejects negative quantity (400)', async () => {
  const res = await request(app)
    .post('/api/items')
    .send({ title: 'X', price: 1, quantity: -5 });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some((d: { path?: string }) => d.path === 'quantity'));
});

test('POST /api/items rejects non-integer quantity (400)', async () => {
  const res = await request(app)
    .post('/api/items')
    .send({ title: 'X', price: 1, quantity: 1.5 });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some((d: { path?: string }) => d.path === 'quantity'));
});

test('POST /api/items rejects invalid image URL (400)', async () => {
  const res = await request(app)
    .post('/api/items')
    .send({ title: 'X', price: 1, quantity: 1, image: 'not-a-url' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some((d: { path?: string }) => d.path === 'image'));
});

// ---------------------------------------------------------------------------
// Get by id
// ---------------------------------------------------------------------------
test('GET /api/items/:id returns an existing item', async () => {
  const created = await createItem();
  const res = await request(app).get(`/api/items/${created.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, created.id);
  assert.equal(res.body.data.title, validItem.title);
});

test('GET /api/items/:id returns 404 for missing id', async () => {
  const res = await request(app).get('/api/items/999999');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.ok(res.body.error.correlationId);
});

// ---------------------------------------------------------------------------
// List + search + pagination
// ---------------------------------------------------------------------------
test('GET /api/items lists all items (newest first)', async () => {
  const a = await createItem({ title: 'First' });
  const b = await createItem({ title: 'Second' });
  const res = await request(app).get('/api/items');
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 2);
  assert.equal(res.body.data.length, 2);
  // Newest (highest id) first.
  assert.equal(res.body.data[0].id, b.id);
  assert.equal(res.body.data[1].id, a.id);
  assert.equal(res.body.query, null);
});

test('GET /api/items?q= matches title', async () => {
  await createItem({ title: 'Red Apple', description: 'a fruit' });
  await createItem({ title: 'Green Banana', description: 'also a fruit' });
  const res = await request(app).get('/api/items').query({ q: 'apple' });
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 1);
  assert.equal(res.body.data[0].title, 'Red Apple');
  assert.equal(res.body.query, 'apple');
});

test('GET /api/items?q= matches description and is case-insensitive', async () => {
  await createItem({ title: 'Widget', description: 'Contains UNIQUEKEYWORD inside' });
  await createItem({ title: 'Gadget', description: 'nothing here' });
  const res = await request(app).get('/api/items').query({ q: 'uniquekeyword' });
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 1);
  assert.equal(res.body.data[0].title, 'Widget');
});

test('GET /api/items respects pagination', async () => {
  await createItem({ title: 'One' });
  await createItem({ title: 'Two' });
  await createItem({ title: 'Three' });
  const res = await request(app).get('/api/items').query({ page: 1, pageSize: 2 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.pagination.total, 3);
  assert.equal(res.body.pagination.page, 1);
  assert.equal(res.body.pagination.pageSize, 2);
  assert.equal(res.body.pagination.totalPages, 2);

  const page2 = await request(app).get('/api/items').query({ page: 2, pageSize: 2 });
  assert.equal(page2.body.data.length, 1);
});

test('GET /api/items rejects pageSize over the max (400)', async () => {
  const res = await request(app).get('/api/items').query({ pageSize: 1000 });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

// ---------------------------------------------------------------------------
// Update (partial)
// ---------------------------------------------------------------------------
test('PATCH /api/items/:id applies a partial update', async () => {
  const created = await createItem();
  const res = await request(app)
    .patch(`/api/items/${created.id}`)
    .send({ price: 149.99 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.price, 149.99);
  // Untouched fields are preserved.
  assert.equal(res.body.data.title, validItem.title);
  assert.equal(res.body.data.quantity, validItem.quantity);
  // created_at unchanged; updated_at is not earlier than created_at.
  assert.equal(res.body.data.created_at, created.created_at);
  assert.ok(res.body.data.updated_at >= created.created_at);
});

test('PATCH /api/items/:id returns 404 for missing id', async () => {
  const res = await request(app).patch('/api/items/999999').send({ price: 5 });
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('PATCH /api/items/:id rejects an empty body (400)', async () => {
  const created = await createItem();
  const res = await request(app).patch(`/api/items/${created.id}`).send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('PATCH /api/items/:id rejects invalid values (400)', async () => {
  const created = await createItem();
  const res = await request(app)
    .patch(`/api/items/${created.id}`)
    .send({ price: -10 });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.some((d: { path?: string }) => d.path === 'price'));
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
test('DELETE /api/items/:id removes the item (204) then 404 on re-fetch', async () => {
  const created = await createItem();
  const del = await request(app).delete(`/api/items/${created.id}`);
  assert.equal(del.status, 204);
  const get = await request(app).get(`/api/items/${created.id}`);
  assert.equal(get.status, 404);
});

test('DELETE /api/items/:id returns 404 for missing id', async () => {
  const res = await request(app).delete('/api/items/999999');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});
