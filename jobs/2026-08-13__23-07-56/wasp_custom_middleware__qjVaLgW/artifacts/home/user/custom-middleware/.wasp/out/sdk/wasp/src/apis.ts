import { type Request, type Response } from "express";

export const statusApi = (req: Request, res: Response, context: any) => {
  res.status(200).json({ status: "ok" });
};

export const echoApi = (req: Request, res: Response, context: any) => {
  const body = req.body;
  const bytes = Buffer.isBuffer(body) ? body.length : 0;
  res.status(200).json({ bytes });
};
