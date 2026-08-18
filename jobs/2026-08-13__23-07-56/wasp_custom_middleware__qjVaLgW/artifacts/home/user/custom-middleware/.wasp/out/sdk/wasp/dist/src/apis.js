export const statusApi = (req, res, context) => {
    res.status(200).json({ status: "ok" });
};
export const echoApi = (req, res, context) => {
    const body = req.body;
    const bytes = Buffer.isBuffer(body) ? body.length : 0;
    res.status(200).json({ bytes });
};
//# sourceMappingURL=apis.js.map