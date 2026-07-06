import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";

const TEST_ENDPOINTS = typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test"
    ? await import("./endpoints_testing.js")
    : null;

export async function addSite(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.addSite(params, opts);
    }

    return apiCall("monitor", "addSite", params, opts);
}
export async function listSites(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.listSites(params, opts);
    }

    return apiCall("monitor", "listSites", params, opts);
}
export async function checkAll(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.checkAll(params, opts);
    }

    return apiCall("monitor", "checkAll", params, opts);
}

export class Client {
  constructor() {
    this.addSite = addSite;
    this.listSites = listSites;
    this.checkAll = checkAll;
  }
}

let _client_instance;

export function ref() {
  if (!_client_instance) {
    _client_instance = new Client();
  }
  return _client_instance;
}
