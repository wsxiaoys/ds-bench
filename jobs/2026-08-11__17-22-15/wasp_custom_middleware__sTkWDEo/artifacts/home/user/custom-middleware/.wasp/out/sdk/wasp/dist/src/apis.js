export const status = (req, res, context) => {
    res.status(200).json({ status: "ok" });
};
export const echo = (req, res, context) => {
    const body = req.body;
    const byteLength = Buffer.isBuffer(body) ? body.length : 0;
    res.status(200).json({ bytes: byteLength });
};
//# sourceMappingURL=apis.js.map