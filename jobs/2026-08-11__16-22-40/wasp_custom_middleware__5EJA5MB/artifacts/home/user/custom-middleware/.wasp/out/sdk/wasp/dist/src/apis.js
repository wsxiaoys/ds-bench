export const statusHandler = (req, res, context) => {
    res.json({ status: "ok" });
};
export const echoHandler = (req, res, context) => {
    const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
    res.json({ bytes });
};
//# sourceMappingURL=apis.js.map