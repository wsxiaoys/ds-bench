import { type StatusApi, type EchoApi } from "wasp/server/api";

export const statusHandler: StatusApi = (req, res, context) => {
  res.json({ status: "ok" });
};

export const echoHandler: EchoApi = (req, res, context) => {
  const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
  res.json({ bytes });
};
