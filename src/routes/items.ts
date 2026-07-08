import { Router } from 'express';
import { itemRepository } from '../repositories/itemRepository';
import { ApiError } from '../errors';
import {
  createItemSchema,
  updateItemSchema,
  idParamSchema,
  searchQuerySchema,
} from '../validation/item';

export const itemsRouter = Router();

/**
 * GET /api/items
 * Search + list with pagination.
 *   ?q=<text>        optional full-text (LIKE) match on title/description
 *   ?page=<n>        1-based page number (default 1)
 *   ?pageSize=<n>    default 20, max 100
 * When q is omitted, returns all items (newest first).
 */
itemsRouter.get('/', (req, res) => {
  const { q, page, pageSize } = searchQuerySchema.parse(req.query);
  const result = itemRepository.search(q, page, pageSize);
  res.status(200).json({
    data: result.items,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    },
    query: q ?? null,
  });
});

/** GET /api/items/:id — fetch one item. */
itemsRouter.get('/:id', (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const item = itemRepository.getById(id);
  if (!item) throw ApiError.notFound(`Item ${id} not found`);
  res.status(200).json({ data: item });
});

/** POST /api/items — create an item. */
itemsRouter.post('/', (req, res) => {
  const input = createItemSchema.parse(req.body);
  const item = itemRepository.create(input);
  res.status(201).location(`/api/items/${item.id}`).json({ data: item });
});

/** PATCH /api/items/:id — partial update. */
itemsRouter.patch('/:id', (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const input = updateItemSchema.parse(req.body);
  const item = itemRepository.update(id, input);
  if (!item) throw ApiError.notFound(`Item ${id} not found`);
  res.status(200).json({ data: item });
});

/** DELETE /api/items/:id — remove an item. */
itemsRouter.delete('/:id', (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const deleted = itemRepository.delete(id);
  if (!deleted) throw ApiError.notFound(`Item ${id} not found`);
  res.status(204).send();
});
