import { type CreatePoll, type GetPollResults } from "wasp/server/api";

export const createPoll: CreatePoll = async (req, res, context) => {
  // 1. 401 Unauthenticated
  if (!context.user) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  const { slug, question, options } = req.body;

  // 2. 400 Invalid Payload
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,32}$/.test(slug)) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  if (typeof question !== "string" || question.trim() === "") {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > 8 ||
    options.some((opt) => typeof opt !== "string" || opt.trim() === "")
  ) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  const uniqueOptions = new Set(options);
  if (uniqueOptions.size !== options.length) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  // 3. 409 Slug Taken
  const existingPoll = await context.entities.Poll.findUnique({
    where: { slug },
  });
  if (existingPoll) {
    return res.status(409).json({ error: "SLUG_TAKEN" });
  }

  const username = context.user.identities.username?.id;
  if (!username) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  const createdPoll = await context.entities.Poll.create({
    data: {
      slug,
      question,
      isClosed: false,
      revision: 0,
      creatorId: context.user.id,
      options: {
        create: options.map((label, index) => ({
          label,
          position: index,
        })),
      },
    },
    include: {
      options: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  return res.status(201).json({
    slug: createdPoll.slug,
    question: createdPoll.question,
    isClosed: createdPoll.isClosed,
    revision: createdPoll.revision,
    creator: username,
    options: createdPoll.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      position: opt.position,
    })),
  });
};

export const getPollResults: GetPollResults = async (req, res, context) => {
  const slug = req.params.slug as string;

  const poll: any = await context.entities.Poll.findUnique({
    where: { slug },
    include: {
      options: {
        orderBy: {
          position: "asc",
        },
        include: {
          votes: {
            include: {
              user: {
                include: {
                  auth: {
                    include: {
                      identities: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!poll) {
    return res.status(404).json({ error: "POLL_NOT_FOUND" });
  }

  let totalVotes = 0;
  const optionResults = poll.options.map((opt: any) => {
    const votesCount = opt.votes.length;
    totalVotes += votesCount;

    const voters = opt.votes
      .map((v: any) => v.user?.auth?.identities?.find((id: any) => id.providerName === "username")?.providerUserId)
      .filter((u: any): u is string => typeof u === "string" && u !== "")
      .sort();

    return {
      id: opt.id,
      label: opt.label,
      position: opt.position,
      votes: votesCount,
      voters,
    };
  });

  let leaderOptionId: number | null = null;
  if (totalVotes > 0) {
    let maxVotes = -1;
    let bestPosition = Infinity;
    for (const optRes of optionResults) {
      if (optRes.votes > maxVotes) {
        maxVotes = optRes.votes;
        leaderOptionId = optRes.id;
        bestPosition = optRes.position;
      } else if (optRes.votes === maxVotes) {
        if (optRes.position < bestPosition) {
          leaderOptionId = optRes.id;
          bestPosition = optRes.position;
        }
      }
    }
  }

  return res.status(200).json({
    slug: poll.slug,
    question: poll.question,
    isClosed: poll.isClosed,
    revision: poll.revision,
    totalVotes,
    leaderOptionId,
    options: optionResults,
  });
};
