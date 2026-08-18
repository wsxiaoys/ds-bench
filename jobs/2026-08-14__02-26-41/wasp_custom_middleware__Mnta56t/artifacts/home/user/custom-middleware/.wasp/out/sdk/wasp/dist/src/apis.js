export const status = (req, res, context) => {
    res.json({ status: "ok" });
};
export const echo = (req, res, context) => {
    console.log('echo req.body:', req.body, 'type:', typeof req.body, 'isBuffer:', Buffer.isBuffer(req.body));
    let bytes = 0;
    if (Buffer.isBuffer(req.body)) {
        bytes = req.body.length;
    }
    else if (typeof req.body === 'string') {
        bytes = Buffer.byteLength(req.body);
    }
    res.json({ bytes });
};
//# sourceMappingURL=apis.js.map