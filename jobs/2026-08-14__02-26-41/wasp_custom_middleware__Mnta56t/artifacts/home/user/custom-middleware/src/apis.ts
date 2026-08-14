import { Request, Response } from 'express'

export const status = (req: Request, res: Response, context: any) => {
  res.json({ status: "ok" })
}

export const echo = (req: Request, res: Response, context: any) => {
  let bytes = 0
  if (Buffer.isBuffer(req.body)) {
    bytes = req.body.length
  } else if (typeof req.body === 'string') {
    bytes = Buffer.byteLength(req.body)
  }
  res.json({ bytes })
}
