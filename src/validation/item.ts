import { z } from 'zod';
import { config } from '../config';

/**
 * Zod schemas define the API contract at the edge. Parsing failures are
 * translated into standardized 400 VALIDATION_ERROR responses by the route
 * handlers / error middleware.
 */

// A URL that is optional and may be explicitly cleared with null.
const imageUrl = z
  .string()
  .trim()
  .url('image must be a valid URL')
  .max(2048);

export const createItemSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  price: z.number({ invalid_type_error: 'price must be a number' }).nonnegative('price must be >= 0')
      .multipleOf(0.01, { message: "price can have at most 2 decimal places" }),
  quantity: z
      .number({ invalid_type_error: 'quantity must be a number' })
      .int('quantity must be an integer')
      .nonnegative('quantity must be >= 0'),
  description: z.string().trim().max(5000).optional(),
  image: imageUrl.optional(),
});

// Partial update: every field optional, but reject an empty body.
export const updateItemSchema = createItemSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one field must be provided' }
);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
});

export const searchQuerySchema = z.object({
  // Free-text query matched against title + description. Optional so this
  // endpoint doubles as "list all".
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().max(config.maxPage).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(config.maxPageSize)
    .default(config.defaultPageSize),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
