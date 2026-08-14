import type { Status, Echo } from "wasp/server/api";

export const status: Status = (_req, res) => {
  res.status(200).json({ status: "ok" });
};

export const echo: Echo = (req, res) => {
  const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
  res.status(200).json({ bytes });
};
