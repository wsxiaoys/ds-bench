import { type Status, type Echo } from "wasp/server/api"

export const status: Status = (req, res, context) => {
  res.status(200).json({ status: "ok" })
}

export const echo: Echo = (req, res, context) => {
  const body = req.body
  const byteLength = Buffer.isBuffer(body) ? body.length : 0
  res.status(200).json({ bytes: byteLength })
}
