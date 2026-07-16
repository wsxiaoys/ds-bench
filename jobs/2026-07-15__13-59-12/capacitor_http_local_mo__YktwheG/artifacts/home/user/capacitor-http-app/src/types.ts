/**
 * Shared domain types used by the typed API client and the round-trip runner.
 */

export interface Product {
  id: number;
  name: string;
  price: number;
}

export interface CreateOrderRequest {
  productId: number;
  quantity: number;
}

export interface Order {
  orderId: string;
  productId: number;
  quantity: number;
  total: number;
}

/**
 * A typed error raised by the API client whenever the HTTP response has a
 * non-2xx status code. The numeric HTTP status is programmatically accessible
 * via the `status` property.
 */
export class ApiRequestError extends Error {
  /** The HTTP status code returned by the server. */
  readonly status: number;
  /** The parsed response body (when available). */
  readonly data: unknown;

  constructor(status: number, data: unknown, message?: string) {
    super(message ?? `API request failed with status ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
  }
}