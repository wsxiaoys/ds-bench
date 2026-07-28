import { z } from 'zod'

export const CATEGORY_VALUES = [
  'electronics',
  'books',
  'clothing',
  'home',
  'toys',
] as const

export type CategorySlug = (typeof CATEGORY_VALUES)[number]

export const SORT_VALUES = [
  'name_asc',
  'price_asc',
  'price_desc',
  'rating_desc',
] as const

export type SortValue = (typeof SORT_VALUES)[number]

export const PAGE_SIZE = 6

export const DEFAULTS = {
  q: '',
  categories: [] as Array<CategorySlug>,
  minPrice: 0,
  maxPrice: 1_000_000,
  inStock: false,
  sort: 'name_asc' as SortValue,
  page: 1,
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return Number.NaN
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return false
}

function toStringArray(value: unknown): Array<unknown> {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.length > 0) {
    // Support comma-separated fallback in case the URL was hand-edited.
    return value.split(',')
  }
  return []
}

export const searchParamsSchema = z.object({
  q: z.preprocess(
    (v) => (typeof v === 'string' ? v : DEFAULTS.q),
    z.string(),
  ).catch(DEFAULTS.q),

  categories: z.preprocess(
    (v) => toStringArray(v),
    z.array(z.enum(CATEGORY_VALUES)),
  ).catch(DEFAULTS.categories),

  minPrice: z.preprocess(
    (v) => toNumber(v),
    z.number().finite().min(0),
  ).catch(DEFAULTS.minPrice),

  maxPrice: z.preprocess(
    (v) => toNumber(v),
    z.number().finite().min(0),
  ).catch(DEFAULTS.maxPrice),

  inStock: z.preprocess(
    (v) => toBoolean(v),
    z.boolean(),
  ).catch(DEFAULTS.inStock),

  sort: z.preprocess(
    (v) => (typeof v === 'string' ? v : DEFAULTS.sort),
    z.enum(SORT_VALUES),
  ).catch(DEFAULTS.sort),

  page: z.preprocess(
    (v) => toNumber(v),
    z.number().int().min(1),
  ).catch(DEFAULTS.page),
})

export type ProductSearch = z.infer<typeof searchParamsSchema>
