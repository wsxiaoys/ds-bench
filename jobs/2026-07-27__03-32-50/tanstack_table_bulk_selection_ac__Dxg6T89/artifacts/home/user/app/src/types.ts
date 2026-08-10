export type Status = "active" | "archived";

export interface Item {
  id: number;
  name: string;
  category: string;
  status: Status;
}

export interface ItemsResponse {
  rows: Item[];
  total: number;
  page: number;
  pageSize: number;
}
