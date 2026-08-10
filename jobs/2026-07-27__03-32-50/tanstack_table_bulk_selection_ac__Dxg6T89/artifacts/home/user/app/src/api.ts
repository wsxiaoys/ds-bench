import type { ItemsResponse, Status } from "./types";

export async function fetchItems(
  status: Status,
  page: number,
  pageSize: number,
): Promise<ItemsResponse> {
  const params = new URLSearchParams({
    status,
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await fetch(`/api/items?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch items (${res.status})`);
  }
  return res.json();
}

export type BulkArchiveBody =
  | { mode: "selected"; ids: number[] }
  | { mode: "all"; status: Status };

export async function bulkArchive(
  body: BulkArchiveBody,
): Promise<{ archived: number }> {
  const res = await fetch("/api/items/bulk-archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to bulk archive items (${res.status})`);
  }
  return res.json();
}
