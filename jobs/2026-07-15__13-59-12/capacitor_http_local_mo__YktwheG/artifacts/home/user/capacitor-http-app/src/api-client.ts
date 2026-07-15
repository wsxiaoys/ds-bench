import { CapacitorHttp, type HttpOptions, type HttpHeaders } from '@capacitor/core';
import { ApiRequestError, type CreateOrderRequest, type Order, type Product } from './types';

/**
 * A strongly-typed API client built on top of `CapacitorHttp`.
 *
 * `CapacitorHttp` resolves with the numeric `status` and parsed `data` for
 * every response — including non-2xx — so this client is responsible for
 * detecting non-2xx statuses and raising a typed {@link ApiRequestError} whose
 * HTTP status is programmatically accessible.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: HttpHeaders;

  constructor(baseUrl: string, defaultHeaders: HttpHeaders = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultHeaders = defaultHeaders;
  }

  /** List every product. */
  async listProducts(): Promise<Product[]> {
    return this.request<Product[]>({
      method: 'GET',
      url: `${this.baseUrl}/api/products`,
    });
  }

  /** Fetch a single product by id. */
  async getProduct(id: number): Promise<Product> {
    return this.request<Product>({
      method: 'GET',
      url: `${this.baseUrl}/api/products/${id}`,
    });
  }

  /**
   * Create an order.
   *
   * @param body   The order payload (`productId` and `quantity`).
   * @param apiKey The value to send in the `X-Api-Key` header.
   */
  async createOrder(body: CreateOrderRequest, apiKey: string): Promise<Order> {
    return this.request<Order>({
      method: 'POST',
      url: `${this.baseUrl}/api/orders`,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      data: body,
    });
  }

  /**
   * Core request helper. Performs the HTTP call through `CapacitorHttp`,
   * merges default headers, and converts non-2xx responses into a typed
   * {@link ApiRequestError}.
   */
  private async request<T>(options: HttpOptions): Promise<T> {
    const mergedHeaders: HttpHeaders = {
      ...this.defaultHeaders,
      ...(options.headers ?? {}),
    };

    const response = await CapacitorHttp.request({
      ...options,
      headers: mergedHeaders,
    });

    if (response.status < 200 || response.status >= 300) {
      const message =
        typeof response.data === 'object' &&
        response.data !== null &&
        'error' in response.data &&
        typeof (response.data as { error: unknown }).error === 'string'
          ? (response.data as { error: string }).error
          : `Request to ${options.url} failed with status ${response.status}`;
      throw new ApiRequestError(response.status, response.data, message);
    }

    return response.data as T;
  }
}

export { ApiRequestError };