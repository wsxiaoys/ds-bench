import { prisma } from "wasp/server";
import { getPollState } from "./webSocket.js";

export const createPoll = async (req: any, res: any, context: any) => {
  try {
    // 1. 401 check
    if (!context.user) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    const { slug, question, options } = req.body;

    // 2. 400 check
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,32}$/.test(slug)) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    if (typeof question !== "string" || question.trim() === "") {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    for (const opt of options) {
      if (typeof opt !== "string" || opt.trim() === "") {
        return res.status(400).json({ error: "INVALID_PAYLOAD" });
      }
    }
    const uniqueOptions = new Set(options);
    if (uniqueOptions.size !== options.length) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }

    // 3. 409 check
    const existingPoll = await prisma.poll.findUnique({
      where: { slug }
    });
    if (existingPoll) {
      return res.status(409).json({ error: "SLUG_TAKEN" });
    }

    // 4. Create poll and options
    const createdPoll = await prisma.$transaction(async (tx) => {
      return await tx.poll.create({
        data: {
          slug,
          question,
          creatorId: context.user.id,
          options: {
            create: options.map((label: string, index: number) => ({
              label,
              position: index
            }))
          }
        },
        include: {
          options: {
            orderBy: { position: "asc" }
          }
        }
      });
    });

    const creatorUsername = context.user.identities.username?.id || "Unknown";

    return res.status(201).json({
      slug: createdPoll.slug,
      question: createdPoll.question,
      isClosed: createdPoll.isClosed,
      revision: createdPoll.revision,
      creator: creatorUsername,
      options: createdPoll.options.map((opt: any) => ({
        id: opt.id,
        label: opt.label,
        position: opt.position
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: "SERVER_ERROR", message: error.message || "An error occurred." });
  }
};

export const getPollResults = async (req: any, res: any, context: any) => {
  try {
    const { slug } = req.params;

    const state = await getPollState(slug, null);
    if (!state) {
      return res.status(404).json({ error: "POLL_NOT_FOUND" });
    }

    // Destructure to remove myVoteOptionId
    const { myVoteOptionId, ...results } = state;

    return res.status(200).json(results);
  } catch (error: any) {
    return res.status(500).json({ error: "SERVER_ERROR", message: error.message || "An error occurred." });
  }
};
