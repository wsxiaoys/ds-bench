import type { CreatePoll, GetPollResults } from "wasp/server/api";

export const createPoll: CreatePoll<
  never,
  any
> = async (req, res, context) => {
  // 401 check
  if (!context.user) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  const { slug, question, options } = req.body;

  // 400 check
  const isSlugValid = typeof slug === "string" && /^[a-z0-9-]{1,32}$/.test(slug);
  const isQuestionValid = typeof question === "string" && question.length > 0;
  const areOptionsValid = Array.isArray(options) &&
    options.length >= 2 &&
    options.length <= 8 &&
    options.every(opt => typeof opt === "string" && opt.length > 0) &&
    (new Set(options).size === options.length);

  if (!isSlugValid || !isQuestionValid || !areOptionsValid) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  // 409 check
  const existingPoll = await context.entities.Poll.findUnique({
    where: { slug }
  });
  if (existingPoll) {
    return res.status(409).json({ error: "SLUG_TAKEN" });
  }

  // Find creator's username
  const creatorUsername = context.user.identities.username?.id || "";

  // Create poll and options
  const createdPoll = await context.entities.Poll.create({
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
};

export const getPollResults: GetPollResults<
  { slug: string },
  any
> = async (req, res, context) => {
  const { slug } = req.params;

  const poll = await context.entities.Poll.findUnique({
    where: { slug },
    include: {
      options: {
        orderBy: { position: "asc" }
      }
    }
  });

  if (!poll) {
    return res.status(404).json({ error: "POLL_NOT_FOUND" });
  }

  // Fetch all votes for this poll
  const votes = await context.entities.Vote.findMany({
    where: { pollId: poll.id },
    include: {
      user: {
        include: {
          auth: {
            include: {
              identities: true
            }
          }
        }
      }
    }
  });

  const totalVotes = votes.length;

  const optionsData = poll.options.map((opt: any) => {
    const optVotes = votes.filter((v: any) => v.optionId === opt.id);
    const voters = optVotes
      .map((v: any) => {
        const usernameId = v.user.auth?.identities.find((id: any) => id.providerName === "username");
        return usernameId?.providerUserId;
      })
      .filter(Boolean)
      .sort();

    return {
      id: opt.id,
      label: opt.label,
      position: opt.position,
      votes: optVotes.length,
      voters
    };
  });

  let leaderOptionId: number | null = null;
  if (totalVotes > 0) {
    let maxVotes = -1;
    let bestPos = Infinity;
    for (const opt of optionsData) {
      if (opt.votes > maxVotes) {
        maxVotes = opt.votes;
        bestPos = opt.position;
        leaderOptionId = opt.id;
      } else if (opt.votes === maxVotes) {
        if (opt.position < bestPos) {
          bestPos = opt.position;
          leaderOptionId = opt.id;
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
    options: optionsData
  });
};
