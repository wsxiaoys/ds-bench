import { prisma } from "wasp/server";

// Keep track of active subscriptions synchronously: slug -> Set of Sockets
const pollSubscriptions = new Map<string, Set<any>>();

export async function getPollState(pollIdOrSlug: number | string, userId: number | null) {
  const poll = await prisma.poll.findFirst({
    where: typeof pollIdOrSlug === "number" ? { id: pollIdOrSlug } : { slug: pollIdOrSlug },
    include: {
      options: {
        orderBy: { position: "asc" }
      },
      votes: {
        include: {
          user: {
            include: {
              auth: {
                include: {
                  identities: {
                    where: { providerName: "username" }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!poll) return null;

  const optionVotesMap = new Map<number, number>();
  const optionVotersMap = new Map<number, string[]>();

  for (const option of poll.options) {
    optionVotesMap.set(option.id, 0);
    optionVotersMap.set(option.id, []);
  }

  let totalVotes = 0;
  let myVoteOptionId: number | null = null;

  for (const vote of poll.votes) {
    if (optionVotesMap.has(vote.optionId)) {
      optionVotesMap.set(vote.optionId, (optionVotesMap.get(vote.optionId) || 0) + 1);
      
      const username = vote.user.auth?.identities[0]?.providerUserId || "Unknown";
      optionVotersMap.get(vote.optionId)?.push(username);
      
      totalVotes++;
    }
    if (userId && vote.userId === userId) {
      myVoteOptionId = vote.optionId;
    }
  }

  // Sort voters ascending by Unicode code point
  for (const option of poll.options) {
    const voters = optionVotersMap.get(option.id) || [];
    voters.sort();
  }

  // Calculate leaderOptionId
  let leaderOptionId: number | null = null;
  if (totalVotes > 0) {
    let maxVotes = -1;
    for (const option of poll.options) {
      const votesCount = optionVotesMap.get(option.id) || 0;
      if (votesCount > maxVotes) {
        maxVotes = votesCount;
        leaderOptionId = option.id;
      }
    }
  }

  const options = poll.options.map(option => ({
    id: option.id,
    label: option.label,
    position: option.position,
    votes: optionVotesMap.get(option.id) || 0,
    voters: optionVotersMap.get(option.id) || []
  }));

  return {
    slug: poll.slug,
    question: poll.question,
    isClosed: poll.isClosed,
    revision: poll.revision,
    totalVotes,
    leaderOptionId,
    myVoteOptionId,
    options
  };
}

export async function broadcastPollState(slug: string) {
  try {
    const sockets = pollSubscriptions.get(slug);
    if (!sockets || sockets.size === 0) return;

    for (const socket of sockets) {
      const userId = socket.data.user?.id || null;
      const state = await getPollState(slug, userId);
      if (state) {
        socket.emit("poll:state", state);
      }
    }
  } catch (error) {
    console.error("Error broadcasting poll state:", error);
  }
}

export const webSocketFn = (io: any, context: any) => {
  io.on("connection", (socket: any) => {
    // Clean up subscriptions on disconnect
    socket.on("disconnect", () => {
      for (const [slug, sockets] of pollSubscriptions.entries()) {
        sockets.delete(socket);
      }
    });

    // Helper to validate common checks (UNAUTHENTICATED, INVALID_PAYLOAD, POLL_NOT_FOUND, NOT_SUBSCRIBED)
    // Returns { user, slug, poll } if valid, otherwise emits error and returns null
    const validateEvent = async (eventName: string, payload: any, checkSubscription = true) => {
      const user = socket.data.user;
      if (!user) {
        socket.emit("poll:error", { code: "UNAUTHENTICATED", message: "User is not authenticated." });
        return null;
      }

      if (!payload || typeof payload !== "object") {
        socket.emit("poll:error", { code: "INVALID_PAYLOAD", message: "Payload must be an object." });
        return null;
      }

      const { slug } = payload;
      if (typeof slug !== "string" || slug.trim() === "") {
        socket.emit("poll:error", { code: "INVALID_PAYLOAD", message: "Slug must be a non-empty string." });
        return null;
      }

      const poll = await prisma.poll.findUnique({
        where: { slug },
        include: { options: true }
      });

      if (!poll) {
        socket.emit("poll:error", { code: "POLL_NOT_FOUND", message: `Poll with slug ${slug} not found.` });
        return null;
      }

      if (checkSubscription) {
        const isSubscribed = pollSubscriptions.get(slug)?.has(socket) ?? false;
        if (!isSubscribed) {
          socket.emit("poll:error", { code: "NOT_SUBSCRIBED", message: `You are not subscribed to poll ${slug}.` });
          return null;
        }
      }

      return { user, slug, poll };
    };

    socket.on("poll:subscribe", async (payload: any) => {
      try {
        const valid = await validateEvent("poll:subscribe", payload, false);
        if (!valid) return;

        const { slug, user } = valid;
        if (!pollSubscriptions.has(slug)) {
          pollSubscriptions.set(slug, new Set());
        }
        pollSubscriptions.get(slug)!.add(socket);

        // Send state to this connection only
        const state = await getPollState(slug, user.id);
        if (state) {
          socket.emit("poll:state", state);
        }
      } catch (error: any) {
        socket.emit("poll:error", { code: "SERVER_ERROR", message: error.message || "An error occurred." });
      }
    });

    socket.on("poll:unsubscribe", async (payload: any) => {
      try {
        const valid = await validateEvent("poll:unsubscribe", payload, false);
        if (!valid) return;

        const { slug } = valid;
        pollSubscriptions.get(slug)?.delete(socket);
      } catch (error: any) {
        socket.emit("poll:error", { code: "SERVER_ERROR", message: error.message || "An error occurred." });
      }
    });

    socket.on("poll:vote", async (payload: any) => {
      try {
        // Precedence 1-4
        const valid = await validateEvent("poll:vote", payload, true);
        if (!valid) return;

        const { user, slug, poll } = valid;
        const { optionId } = payload;

        if (typeof optionId !== "number" || !Number.isInteger(optionId)) {
          socket.emit("poll:error", { code: "INVALID_PAYLOAD", message: "Option ID must be an integer." });
          return;
        }

        // Per-event: POLL_CLOSED
        if (poll.isClosed) {
          socket.emit("poll:error", { code: "POLL_CLOSED", message: "The poll is closed." });
          return;
        }

        // Per-event: OPTION_NOT_FOUND
        const hasOption = poll.options.some((o: any) => o.id === optionId);
        if (!hasOption) {
          socket.emit("poll:error", { code: "OPTION_NOT_FOUND", message: "Option not found in this poll." });
          return;
        }

        // Check existing vote
        const existingVote = await prisma.vote.findUnique({
          where: {
            pollId_userId: {
              pollId: poll.id,
              userId: user.id
            }
          }
        });

        if (existingVote) {
          if (existingVote.optionId === optionId) {
            // No-op: revision must not change and poll:state must be sent to the requesting connection only
            const state = await getPollState(slug, user.id);
            if (state) {
              socket.emit("poll:state", state);
            }
            return;
          } else {
            // Mutate vote
            await prisma.$transaction([
              prisma.vote.update({
                where: { id: existingVote.id },
                data: { optionId }
              }),
              prisma.poll.update({
                where: { id: poll.id },
                data: { revision: { increment: 1 } }
              })
            ]);
          }
        } else {
          // Cast new vote
          await prisma.$transaction([
            prisma.vote.create({
              data: {
                pollId: poll.id,
                userId: user.id,
                optionId
              }
            }),
            prisma.poll.update({
              where: { id: poll.id },
              data: { revision: { increment: 1 } }
            })
          ]);
        }

        // Broadcast updated state to all subscribers
        await broadcastPollState(slug);
      } catch (error: any) {
        socket.emit("poll:error", { code: "SERVER_ERROR", message: error.message || "An error occurred." });
      }
    });

    socket.on("poll:retract", async (payload: any) => {
      try {
        const valid = await validateEvent("poll:retract", payload, true);
        if (!valid) return;

        const { user, slug, poll } = valid;

        // Per-event: POLL_CLOSED
        if (poll.isClosed) {
          socket.emit("poll:error", { code: "POLL_CLOSED", message: "The poll is closed." });
          return;
        }

        // Check existing vote
        const existingVote = await prisma.vote.findUnique({
          where: {
            pollId_userId: {
              pollId: poll.id,
              userId: user.id
            }
          }
        });

        // Per-event: NO_ACTIVE_VOTE
        if (!existingVote) {
          socket.emit("poll:error", { code: "NO_ACTIVE_VOTE", message: "You have no active vote in this poll." });
          return;
        }

        // Delete vote and increment revision
        await prisma.$transaction([
          prisma.vote.delete({
            where: { id: existingVote.id }
          }),
          prisma.poll.update({
            where: { id: poll.id },
            data: { revision: { increment: 1 } }
          })
        ]);

        // Broadcast updated state to all subscribers
        await broadcastPollState(slug);
      } catch (error: any) {
        socket.emit("poll:error", { code: "SERVER_ERROR", message: error.message || "An error occurred." });
      }
    });

    socket.on("poll:close", async (payload: any) => {
      try {
        const valid = await validateEvent("poll:close", payload, true);
        if (!valid) return;

        const { user, slug, poll } = valid;

        // Per-event: NOT_POLL_CREATOR
        if (poll.creatorId !== user.id) {
          socket.emit("poll:error", { code: "NOT_POLL_CREATOR", message: "Only the creator can close the poll." });
          return;
        }

        // Per-event: ALREADY_CLOSED
        if (poll.isClosed) {
          socket.emit("poll:error", { code: "ALREADY_CLOSED", message: "The poll is already closed." });
          return;
        }

        // Close poll and increment revision
        await prisma.poll.update({
          where: { id: poll.id },
          data: {
            isClosed: true,
            revision: { increment: 1 }
          }
        });

        // Broadcast updated state to all subscribers
        await broadcastPollState(slug);
      } catch (error: any) {
        socket.emit("poll:error", { code: "SERVER_ERROR", message: error.message || "An error occurred." });
      }
    });
  });
};
