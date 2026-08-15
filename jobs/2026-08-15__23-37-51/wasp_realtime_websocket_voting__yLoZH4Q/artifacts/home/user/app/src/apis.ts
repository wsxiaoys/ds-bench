import { getUsername } from "wasp/auth";

export function formatPollState(poll: any, currentUserId?: number | null) {
  const optionsMap = new Map<number, { id: number, label: string, position: number, votes: number, voters: string[] }>();
  
  for (const opt of poll.options) {
    optionsMap.set(opt.id, {
      id: opt.id,
      label: opt.label,
      position: opt.position,
      votes: 0,
      voters: [],
    });
  }
  
  let myVoteOptionId: number | null = null;
  
  for (const vote of poll.votes) {
    if (currentUserId && vote.userId === currentUserId) {
      myVoteOptionId = vote.optionId;
    }
    const optData = optionsMap.get(vote.optionId);
    if (optData) {
      optData.votes += 1;
      const username = getUsername(vote.user);
      if (username) {
        optData.voters.push(username);
      }
    }
  }
  
  const options = Array.from(optionsMap.values()).sort((a, b) => a.position - b.position);
  
  for (const opt of options) {
    opt.voters.sort();
  }
  
  const totalVotes = poll.votes.length;
  
  let leaderOptionId: number | null = null;
  if (totalVotes > 0) {
    let maxVotes = -1;
    for (const opt of options) {
      if (opt.votes > maxVotes) {
        maxVotes = opt.votes;
        leaderOptionId = opt.id;
      }
    }
  }
  
  const baseState = {
    slug: poll.slug,
    question: poll.question,
    isClosed: poll.isClosed,
    revision: poll.revision,
    totalVotes,
    leaderOptionId,
    options,
  };
  
  if (currentUserId !== undefined) {
    return {
      ...baseState,
      myVoteOptionId,
    };
  }
  
  return baseState;
}

export const createPoll = async (req: any, res: any, context: any) => {
  // 1. 401 UNAUTHENTICATED
  if (!context.user) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  const { slug, question, options } = req.body;

  // 2. 400 INVALID_PAYLOAD
  if (
    typeof slug !== "string" ||
    !/^[a-z0-9-]{1,32}$/.test(slug) ||
    typeof question !== "string" ||
    question.trim() === "" ||
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > 8 ||
    options.some(opt => typeof opt !== "string" || opt.trim() === "") ||
    new Set(options).size !== options.length
  ) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  // 3. 409 SLUG_TAKEN
  const existingPoll = await context.entities.Poll.findUnique({
    where: { slug },
  });
  if (existingPoll) {
    return res.status(409).json({ error: "SLUG_TAKEN" });
  }

  // Create the poll
  const poll = await context.entities.Poll.create({
    data: {
      slug,
      question,
      creatorId: context.user.id,
      options: {
        create: options.map((label: string, index: number) => ({
          label,
          position: index,
        })),
      },
    },
    include: {
      options: {
        orderBy: { position: "asc" },
      },
    },
  });

  const creatorUsername = getUsername(context.user) || "";

  return res.status(201).json({
    slug: poll.slug,
    question: poll.question,
    isClosed: poll.isClosed,
    revision: poll.revision,
    creator: creatorUsername,
    options: poll.options.map((opt: any) => ({
      id: opt.id,
      label: opt.label,
      position: opt.position,
    })),
  });
};

export const getPollResults = async (req: any, res: any, context: any) => {
  const { slug } = req.params;

  const poll = await context.entities.Poll.findUnique({
    where: { slug },
    include: {
      options: {
        orderBy: { position: "asc" },
      },
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
  });

  if (!poll) {
    return res.status(404).json({ error: "POLL_NOT_FOUND" });
  }

  const results = formatPollState(poll);
  return res.status(200).json(results);
};
