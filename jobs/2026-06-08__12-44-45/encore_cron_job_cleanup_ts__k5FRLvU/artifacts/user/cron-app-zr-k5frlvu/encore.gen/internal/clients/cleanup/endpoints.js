import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";

const TEST_ENDPOINTS = typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test"
    ? await import("./endpoints_testing.js")
    : null;

export async function createRecord(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.createRecord(params, opts);
    }

    return apiCall("cleanup", "createRecord", params, opts);
}
export async function cleanup(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.cleanup(params, opts);
    }

    return apiCall("cleanup", "cleanup", params, opts);
}

export class Client {
  constructor() {
    this.createRecord = createRecord;
    this.cleanup = cleanup;
  }
}

let _client_instance;

export function ref() {
  if (!_client_instance) {
    _client_instance = new Client();
  }
  return _client_instance;
}
