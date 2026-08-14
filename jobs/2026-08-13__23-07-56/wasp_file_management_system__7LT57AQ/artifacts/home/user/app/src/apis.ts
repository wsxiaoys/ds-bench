import fs from "fs";
import { Request, Response } from "express";

export const downloadFile = async (req: Request, res: Response, context: any) => {
  const { linkId } = req.params;
  const password = req.query.password as string | undefined;

  try {
    // 1. Fetch the share link
    const shareLink = await context.entities.ShareLink.findUnique({
      where: { id: linkId },
      include: { file: true },
    });

    if (!shareLink) {
      return res.status(404).json({ error: "Share link not found" });
    }

    // 2. Check expiration
    if (shareLink.expiresAt && new Date() > new Date(shareLink.expiresAt)) {
      return res.status(410).json({ error: "Link has expired" });
    }

    // 3. Check password
    if (shareLink.password && shareLink.password !== password) {
      return res.status(403).json({ error: "Invalid password" });
    }

    const file = shareLink.file;
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // 4. Verify file exists on disk
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ error: "File physical content not found" });
    }

    // 5. Log the access
    // Extract IP address and User-Agent
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    await context.entities.AccessLog.create({
      data: {
        fileId: file.id,
        shareLinkId: shareLink.id,
        ipAddress: ipAddress,
        userAgent: userAgent,
      },
    });

    // 6. Serve the file
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Length", file.size);

    const fileStream = fs.createReadStream(file.filePath);
    fileStream.pipe(res);

  } catch (error: any) {
    console.error("Download error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
