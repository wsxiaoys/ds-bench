import { CapacitorHttp } from '@capacitor/core';

export class HttpError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any) {
    const message = data && typeof data === 'object' && 'error' in data
      ? data.error
      : `HTTP Error ${status}`;
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

export interface Product {
  id: number;
  name: string;
  price: number;
}

export interface CreateOrderRequest {
  productId: number;
  quantity: number;
}

export interface OrderResponse {
  orderId: string;
  productId: number;
  quantity: number;
  total: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8787') {
    this.baseUrl = baseUrl;
  }

  private checkResponse(response: { status: number; data: any }) {
    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(response.status, response.data);
    }
  }

  async getProducts(): Promise<Product[]> {
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/api/products`,
      headers: {
        'Accept': 'application/json'
      }
    });
    this.checkResponse(response);
    return response.data as Product[];
  }

  async getProduct(id: number): Promise<Product> {
    const response = await CapacitorHttp.get({
      url: `${this.baseUrl}/api/products/${id}`,
      headers: {
        'Accept': 'application/json'
      }
    });
    this.checkResponse(response);
    return response.data as Product;
  }

  async createOrder(order: CreateOrderRequest, apiKey: string): Promise<OrderResponse> {
    const response = await CapacitorHttp.post({
      url: `${this.baseUrl}/api/orders`,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      },
      data: order
    });
    this.checkResponse(response);
    return response.data as OrderResponse;
  }
}
