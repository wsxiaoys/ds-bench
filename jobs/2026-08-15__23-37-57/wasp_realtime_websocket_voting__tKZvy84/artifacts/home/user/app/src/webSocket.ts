import { type WebSocketDefinition, type WaspSocketData } from "wasp/server/webSocket";
import { prisma } from "wasp/server";

type WebSocketFn = WebSocketDefinition<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface ServerToClientEvents {
  "poll:state": (state: any) => void;
  "poll:error": (err: { code: string; message: string }) => void;
}

interface ClientToServerEvents {
  "poll:subscribe": (payload: any) => void;
  "poll:unsubscribe": (payload: any) => void;
  "poll:vote": (payload: any) => void;
  "poll:retract": (payload: any) => void;
  "poll:close": (payload: any) => void;
}

interface InterServerEvents {}

interface SocketData extends WaspSocketData {}

// Helper to send personalized poll state to a single socket
async function sendPersonalizedState(socket: any, slug: string, context: any) {
  const poll = await context.entities.Poll.findUnique({
    where: { slug },
    include: {
      options: {
        orderBy: { position: "asc" }
      }
    }
  });

  if (!poll) return;

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

  const userId = socket.data.user?.id;
  let myVoteOptionId: number | null = null;
  if (userId) {
    const myVote = votes.find((v: any) => v.userId === userId);
    if (myVote) {
      myVoteOptionId = myVote.optionId;
    }
  }

  socket.emit("poll:state", {
    slug: poll.slug,
    question: poll.question,
    isClosed: poll.isClosed,
    revision: poll.revision,
    totalVotes,
    leaderOptionId,
    myVoteOptionId,
    options: optionsData
  });
}

// Helper to broadcast personalized poll state to all sockets in the poll's room
async function broadcastPollState(io: any, slug: string, context: any) {
  const poll = await context.entities.Poll.findUnique({
    where: { slug },
    include: {
      options: {
        orderBy: { position: "asc" }
      }
    }
  });

  if (!poll) return;

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

  const sockets = await io.in(`poll:${slug}`).fetchSockets();
  for (const s of sockets) {
    const userId = s.data.user?.id;
    let myVoteOptionId: number | null = null;
    if (userId) {
      const myVote = votes.find((v: any) => v.userId === userId);
      if (myVote) {
        myVoteOptionId = myVote.optionId;
      }
    }

    s.emit("poll:state", {
      slug: poll.slug,
      question: poll.question,
      isClosed: poll.isClosed,
      revision: poll.revision,
      totalVotes,
      leaderOptionId,
      myVoteOptionId,
      options: optionsData
    });
  }
}

export const webSocketFn: WebSocketFn = (io, context) => {
  io.on("connection", (socket) => {
    // Helper to validate common constraints in precedence order
    async function validateCommon(event: string, payload: any, checkSubscription: boolean) {
      // 1. UNAUTHENTICATED
      if (!socket.data.user) {
        socket.emit("poll:error", {
          code: "UNAUTHENTICATED",
          message: "User is not authenticated."
        });
        return { valid: false };
      }

      // 2. INVALID_PAYLOAD
      if (!payload || typeof payload !== "object") {
        socket.emit("poll:error", {
          code: "INVALID_PAYLOAD",
          message: "Payload must be an object."
        });
        return { valid: false };
      }

      const { slug } = payload;
      if (typeof slug !== "string" || slug === "") {
        socket.emit("poll:error", {
          code: "INVALID_PAYLOAD",
          message: "Slug must be a non-empty string."
        });
        return { valid: false };
      }

      if (event === "poll:vote") {
        const { optionId } = payload;
        if (typeof optionId !== "number" || !Number.isInteger(optionId)) {
          socket.emit("poll:error", {
            code: "INVALID_PAYLOAD",
            message: "Option ID must be an integer number."
          });
          return { valid: false };
        }
      }

      // 3. POLL_NOT_FOUND
      const poll = await context.entities.Poll.findUnique({
        where: { slug }
      });
      if (!poll) {
        socket.emit("poll:error", {
          code: "POLL_NOT_FOUND",
          message: `Poll with slug "${slug}" not found.`
        });
        return { valid: false };
      }

      // 4. NOT_SUBSCRIBED
      if (checkSubscription) {
        const isSubscribed = socket.rooms.has(`poll:${slug}`);
        if (!isSubscribed) {
          socket.emit("poll:error", {
            code: "NOT_SUBSCRIBED",
            message: `You are not subscribed to poll "${slug}".`
          });
          return { valid: false, poll };
        }
      }

      return { valid: true, poll };
    }

    // poll:subscribe
    socket.on("poll:subscribe", async (payload) => {
      const { valid } = await validateCommon("poll:subscribe", payload, false);
      if (!valid) return;

      const { slug } = payload;
      await socket.join(`poll:${slug}`);
      await sendPersonalizedState(socket, slug, context);
    });

    // poll:unsubscribe
    socket.on("poll:unsubscribe", async (payload) => {
      const { valid } = await validateCommon("poll:unsubscribe", payload, false);
      if (!valid) return;

      const { slug } = payload;
      await socket.leave(`poll:${slug}`);
    });

    // poll:vote
    socket.on("poll:vote", async (payload) => {
      const { valid, poll } = await validateCommon("poll:vote", payload, true);
      if (!valid || !poll || !socket.data.user) return;

      const { slug, optionId } = payload;
      const user = socket.data.user;

      // 5. POLL_CLOSED
      if (poll.isClosed) {
        socket.emit("poll:error", {
          code: "POLL_CLOSED",
          message: "This poll is closed."
        });
        return;
      }

      // 6. OPTION_NOT_FOUND
      const options = await context.entities.PollOption.findMany({
        where: { pollId: poll.id }
      });
      const optionExists = options.some((o: any) => o.id === optionId);
      if (!optionExists) {
        socket.emit("poll:error", {
          code: "OPTION_NOT_FOUND",
          message: "Option not found in this poll."
        });
        return;
      }

      // Perform mutation
      let broadcastNeeded = false;
      try {
        await prisma.$transaction(async (tx) => {
          const existingVote = await tx.vote.findUnique({
            where: {
              pollId_userId: {
                pollId: poll.id,
                userId: user.id
              }
            }
          });

          if (existingVote) {
            if (existingVote.optionId === optionId) {
              // No-op
              broadcastNeeded = false;
            } else {
              await tx.vote.update({
                where: { id: existingVote.id },
                data: { optionId }
              });
              await tx.poll.update({
                where: { id: poll.id },
                data: { revision: { increment: 1 } }
              });
              broadcastNeeded = true;
            }
          } else {
            await tx.vote.create({
              data: {
                pollId: poll.id,
                optionId,
                userId: user.id
              }
            });
            await tx.poll.update({
              where: { id: poll.id },
              data: { revision: { increment: 1 } }
            });
            broadcastNeeded = true;
          }
        });
      } catch (err: any) {
        socket.emit("poll:error", {
          code: "MUTATION_FAILED",
          message: err.message || "Failed to cast vote."
        });
        return;
      }

      if (broadcastNeeded) {
        await broadcastPollState(io, slug, context);
      } else {
        await sendPersonalizedState(socket, slug, context);
      }
    });

    // poll:retract
    socket.on("poll:retract", async (payload) => {
      const { valid, poll } = await validateCommon("poll:retract", payload, true);
      if (!valid || !poll || !socket.data.user) return;

      const { slug } = payload;
      const user = socket.data.user;

      // 5. POLL_CLOSED
      if (poll.isClosed) {
        socket.emit("poll:error", {
          code: "POLL_CLOSED",
          message: "This poll is closed."
        });
        return;
      }

      // 6. NO_ACTIVE_VOTE
      const existingVote = await context.entities.Vote.findUnique({
        where: {
          pollId_userId: {
            pollId: poll.id,
            userId: user.id
          }
        }
      });
      if (!existingVote) {
        socket.emit("poll:error", {
          code: "NO_ACTIVE_VOTE",
          message: "You have no active vote in this poll."
        });
        return;
      }

      // Perform retraction
      try {
        await prisma.$transaction(async (tx) => {
          await tx.vote.delete({
            where: { id: existingVote.id }
          });
          await tx.poll.update({
            where: { id: poll.id },
            data: { revision: { increment: 1 } }
          });
        });
      } catch (err: any) {
        socket.emit("poll:error", {
          code: "MUTATION_FAILED",
          message: err.message || "Failed to retract vote."
        });
        return;
      }

      await broadcastPollState(io, slug, context);
    });

    // poll:close
    socket.on("poll:close", async (payload) => {
      const { valid, poll } = await validateCommon("poll:close", payload, true);
      if (!valid || !poll || !socket.data.user) return;

      const { slug } = payload;
      const user = socket.data.user;

      // 5. NOT_POLL_CREATOR
      if (poll.creatorId !== user.id) {
        socket.emit("poll:error", {
          code: "NOT_POLL_CREATOR",
          message: "Only the poll creator can close this poll."
        });
        return;
      }

      // 6. ALREADY_CLOSED
      if (poll.isClosed) {
        socket.emit("poll:error", {
          code: "ALREADY_CLOSED",
          message: "This poll is already closed."
        });
        return;
      }

      // Perform closing
      try {
        await prisma.$transaction(async (tx) => {
          await tx.poll.update({
            where: { id: poll.id },
            data: {
              isClosed: true,
              revision: { increment: 1 }
            }
          });
        });
      } catch (err: any) {
        socket.emit("poll:error", {
          code: "MUTATION_FAILED",
          message: err.message || "Failed to close poll."
        });
        return;
      }

      await broadcastPollState(io, slug, context);
    });
  });
};
