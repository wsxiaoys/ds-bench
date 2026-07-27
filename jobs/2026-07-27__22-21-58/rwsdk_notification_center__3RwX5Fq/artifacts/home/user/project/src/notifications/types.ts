export type Severity = "info" | "warning" | "error";

export type Notification = {
  id: string;
  severity: Severity;
  read: boolean;
  createdAt: number;
};
