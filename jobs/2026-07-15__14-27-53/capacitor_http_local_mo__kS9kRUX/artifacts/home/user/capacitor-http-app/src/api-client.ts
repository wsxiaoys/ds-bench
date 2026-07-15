import { CapacitorHttp } from '@capacitor/core';
import type { HttpHeaders, HttpResponse, HttpResponseType } from '@capacitor/core';

export interface Product {
  id: number;
  name: string;
  price: number;
}

export interface OrderRequest {
  productId: number;
  quantity: number;
}

export interface OrderResponse {
  orderId: string;
  productId: number;
  quantity: number;
  total: number;
}

export interface ErrorPayload {
  error?: string;
}

/**
 * Typed error thrown by {@link ApiClient} when the underlying HTTP response
 * is not a 2xx success. Carries the HTTP status code, URL, and parsed body
 * so callers can react programmatically.
 */
export class ApiHttpError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly body: unknown;
  public readonly headers: HttpHeaders;

  constructor(
    message: string,
    status: number,
    url: string,
    body: unknown,
    headers: HttpHeaders = {},
  ) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.url = url;
    this.body = body;
    this.headers = headers;
    // Preserve proper prototype chain when targeting older runtimes.
    Object.setPrototypeOf(this, ApiHttpError.prototype);
  }
}

export interface ApiClientOptions {
  /** Base URL of the API, e.g. "http://localhost:8787". */
  baseUrl: string;
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  async listProducts(): Promise<Product[]> {
    return this.request<Product[]>('GET', '/api/products');
  }

  async getProduct(id: number): Promise<Product> {
    return this.request<Product>('GET', `/api/products/${id}`);
  }

  async createOrder(body: OrderRequest, apiKey: string): Promise<OrderResponse> {
    return this.request<OrderResponse>('POST', '/api/orders', {
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
    });
  }

  /**
   * Low-level helper around CapacitorHttp that:
   *   - serializes JSON bodies,
   *   - propagates custom headers,
   *   - converts any non-2xx response into a typed {@link ApiHttpError}.
   */
  private async request<T>(
    method: string,
    path: string,
    init: {
      data?: unknown;
      headers?: HttpHeaders;
      responseType?: HttpResponseType;
    } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options = {
      url,
      method,
      headers: init.headers,
      data: init.data as never,
      responseType: init.responseType ?? 'json',
    };

    let response: HttpResponse;
    try {
      response = await CapacitorHttp.request(options);
    } catch (err) {
      // Network-level failure (connection refused, DNS, etc.). Surface as a
      // zero-status ApiHttpError so callers can still inspect it uniformly.
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiHttpError(`Network error contacting ${url}: ${message}`, 0, url, undefined, {});
    }

    if (response.status < 200 || response.status >= 300) {
      const body = response.data as ErrorPayload | undefined;
      const message =
        (body && typeof body === 'object' && typeof body.error === 'string'
          ? body.error
          : `Request failed with status ${response.status}`);
      throw new ApiHttpError(
        message,
        response.status,
        response.url,
        response.data,
        response.headers,
      );
    }

    return response.data as T;
  }
}