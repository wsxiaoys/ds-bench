import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";

const TEST_ENDPOINTS = typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test"
    ? await import("./endpoints_testing.js")
    : null;

export async function dashboard(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.dashboard(params, opts);
    }

    return apiCall("customauth", "dashboard", params, opts);
}

export class Client {
  constructor() {
    this.dashboard = dashboard;
  }
}

let _client_instance;

export function ref() {
  if (!_client_instance) {
    _client_instance = new Client();
  }
  return _client_instance;
}
