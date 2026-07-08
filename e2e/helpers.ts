import { APIRequestContext, expect } from '@playwright/test';
import { endpoints, generateBody, ItemBody } from './endpoints';

/** The item record as returned by the API (optional fields become null). */
export interface Item {
  id: number;
  title: string;
  price: number;
  quantity: number;
  description: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create an item through the public API and return the created record.
 * Fails the test if creation does not return 201.
 */
export async function createItem(
  request: APIRequestContext,
  overrides: Partial<ItemBody> = {}
): Promise<Item> {
  const res = await request.post(endpoints.createItem.path(), {
    data: generateBody(endpoints.createItem, overrides),
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as Item;
}
