export const status = (_req, res) => {
    res.status(200).json({ status: "ok" });
};
export const echo = (req, res) => {
    const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
    res.status(200).json({ bytes });
};
//# sourceMappingURL=apis.js.map