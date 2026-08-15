import { prisma } from "wasp/server";
import { formatPollState } from "./apis.js";

async function broadcastPollState(io: any, poll: any) {
  const roomName = `poll:${poll.slug}`;
  const sockets = await io.in(roomName).fetchSockets();
  for (const s of sockets) {
    const sUser = s.data.user;
    const sUserId = sUser ? sUser.id : null;
    const state = formatPollState(poll, sUserId);
    s.emit("poll:state", state);
  }
}

export const webSocketFn = (io: any, context: any) => {
  io.on("connection", (socket: any) => {
    // Helper to validate and fetch poll
    async function getPollAndVerify(payload: any, checkSubscription = false, eventName: string) {
      // 1. UNAUTHENTICATED
      const user = socket.data.user;
      if (!user) {
        socket.emit("poll:error", { code: "UNAUTHENTICATED", message: "User is not authenticated" });
        return null;
      }

      // 2. INVALID_PAYLOAD
      if (!payload || typeof payload !== "object" || typeof payload.slug !== "string" || payload.slug === "") {
        socket.emit("poll:error", { code: "INVALID_PAYLOAD", message: "Invalid payload" });
        return null;
      }

      if (eventName === "poll:vote") {
        if (typeof payload.optionId !== "number" || !Number.isInteger(payload.optionId)) {
          socket.emit("poll:error", { code: "INVALID_PAYLOAD", message: "Invalid optionId" });
          return null;
        }
      }

      // 3. POLL_NOT_FOUND
      const poll = await prisma.poll.findUnique({
        where: { slug: payload.slug },
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
        socket.emit("poll:error", { code: "POLL_NOT_FOUND", message: "Poll not found" });
        return null;
      }

      // 4. NOT_SUBSCRIBED
      if (checkSubscription) {
        const isSubscribed = socket.rooms.has(`poll:${payload.slug}`);
        if (!isSubscribed) {
          socket.emit("poll:error", { code: "NOT_SUBSCRIBED", message: "Not subscribed to this poll" });
          return null;
        }
      }

      return { user, poll };
    }

    socket.on("poll:subscribe", async (payload: any) => {
      const verified = await getPollAndVerify(payload, false, "poll:subscribe");
      if (!verified) return;

      const { user, poll } = verified;
      socket.join(`poll:${poll.slug}`);

      const state = formatPollState(poll, user.id);
      socket.emit("poll:state", state);
    });

    socket.on("poll:unsubscribe", async (payload: any) => {
      const verified = await getPollAndVerify(payload, false, "poll:unsubscribe");
      if (!verified) return;

      const { poll } = verified;
      socket.leave(`poll:${poll.slug}`);
    });

    socket.on("poll:vote", async (payload: any) => {
      const verified = await getPollAndVerify(payload, true, "poll:vote");
      if (!verified) return;

      const { user, poll } = verified;

      // 5. POLL_CLOSED
      if (poll.isClosed) {
        socket.emit("poll:error", { code: "POLL_CLOSED", message: "Poll is closed" });
        return;
      }

      // 6. OPTION_NOT_FOUND
      const option = poll.options.find((opt: any) => opt.id === payload.optionId);
      if (!option) {
        socket.emit("poll:error", { code: "OPTION_NOT_FOUND", message: "Option not found in this poll" });
        return;
      }

      try {
        const updatedPoll = await prisma.$transaction(async (tx) => {
          const currentPoll = await tx.poll.findUnique({
            where: { id: poll.id },
          });
          if (!currentPoll) {
            throw new Error("POLL_NOT_FOUND");
          }
          if (currentPoll.isClosed) {
            throw new Error("POLL_CLOSED");
          }

          const existingVote = await tx.vote.findUnique({
            where: {
              pollId_userId: {
                pollId: poll.id,
                userId: user.id,
              },
            },
          });

          if (existingVote && existingVote.optionId === payload.optionId) {
            return null;
          }

          await tx.vote.upsert({
            where: {
              pollId_userId: {
                pollId: poll.id,
                userId: user.id,
              },
            },
            create: {
              pollId: poll.id,
              userId: user.id,
              optionId: payload.optionId,
            },
            update: {
              optionId: payload.optionId,
            },
          });

          const newPoll = await tx.poll.update({
            where: { id: poll.id },
            data: {
              revision: { increment: 1 },
            },
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

          return newPoll;
        });

        if (updatedPoll === null) {
          const state = formatPollState(poll, user.id);
          socket.emit("poll:state", state);
          return;
        }

        await broadcastPollState(io, updatedPoll);
      } catch (err: any) {
        if (err.message === "POLL_CLOSED") {
          socket.emit("poll:error", { code: "POLL_CLOSED", message: "Poll is closed" });
          return;
        }
        if (err.message === "POLL_NOT_FOUND") {
          socket.emit("poll:error", { code: "POLL_NOT_FOUND", message: "Poll not found" });
          return;
        }
        throw err;
      }
    });

    socket.on("poll:retract", async (payload: any) => {
      const verified = await getPollAndVerify(payload, true, "poll:retract");
      if (!verified) return;

      const { user, poll } = verified;

      // 5. POLL_CLOSED
      if (poll.isClosed) {
        socket.emit("poll:error", { code: "POLL_CLOSED", message: "Poll is closed" });
        return;
      }

      // 6. NO_ACTIVE_VOTE
      const existingVote = poll.votes.find((v: any) => v.userId === user.id);
      if (!existingVote) {
        socket.emit("poll:error", { code: "NO_ACTIVE_VOTE", message: "No active vote to retract" });
        return;
      }

      try {
        const updatedPoll = await prisma.$transaction(async (tx) => {
          const currentPoll = await tx.poll.findUnique({
            where: { id: poll.id },
          });
          if (!currentPoll) {
            throw new Error("POLL_NOT_FOUND");
          }
          if (currentPoll.isClosed) {
            throw new Error("POLL_CLOSED");
          }

          const vote = await tx.vote.findUnique({
            where: {
              pollId_userId: {
                pollId: poll.id,
                userId: user.id,
              },
            },
          });

          if (!vote) {
            throw new Error("NO_ACTIVE_VOTE");
          }

          await tx.vote.delete({
            where: {
              id: vote.id,
            },
          });

          const newPoll = await tx.poll.update({
            where: { id: poll.id },
            data: {
              revision: { increment: 1 },
            },
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

          return newPoll;
        });

        await broadcastPollState(io, updatedPoll);
      } catch (err: any) {
        if (err.message === "POLL_CLOSED") {
          socket.emit("poll:error", { code: "POLL_CLOSED", message: "Poll is closed" });
          return;
        }
        if (err.message === "NO_ACTIVE_VOTE") {
          socket.emit("poll:error", { code: "NO_ACTIVE_VOTE", message: "No active vote to retract" });
          return;
        }
        if (err.message === "POLL_NOT_FOUND") {
          socket.emit("poll:error", { code: "POLL_NOT_FOUND", message: "Poll not found" });
          return;
        }
        throw err;
      }
    });

    socket.on("poll:close", async (payload: any) => {
      const verified = await getPollAndVerify(payload, true, "poll:close");
      if (!verified) return;

      const { user, poll } = verified;

      // 5. NOT_POLL_CREATOR
      if (poll.creatorId !== user.id) {
        socket.emit("poll:error", { code: "NOT_POLL_CREATOR", message: "Only the creator can close this poll" });
        return;
      }

      // 6. ALREADY_CLOSED
      if (poll.isClosed) {
        socket.emit("poll:error", { code: "ALREADY_CLOSED", message: "Poll is already closed" });
        return;
      }

      try {
        const updatedPoll = await prisma.$transaction(async (tx) => {
          const currentPoll = await tx.poll.findUnique({
            where: { id: poll.id },
          });
          if (!currentPoll) {
            throw new Error("POLL_NOT_FOUND");
          }
          if (currentPoll.creatorId !== user.id) {
            throw new Error("NOT_POLL_CREATOR");
          }
          if (currentPoll.isClosed) {
            throw new Error("ALREADY_CLOSED");
          }

          const newPoll = await tx.poll.update({
            where: { id: poll.id },
            data: {
              isClosed: true,
              revision: { increment: 1 },
            },
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

          return newPoll;
        });

        await broadcastPollState(io, updatedPoll);
      } catch (err: any) {
        if (err.message === "NOT_POLL_CREATOR") {
          socket.emit("poll:error", { code: "NOT_POLL_CREATOR", message: "Only the creator can close this poll" });
          return;
        }
        if (err.message === "ALREADY_CLOSED") {
          socket.emit("poll:error", { code: "ALREADY_CLOSED", message: "Poll is already closed" });
          return;
        }
        if (err.message === "POLL_NOT_FOUND") {
          socket.emit("poll:error", { code: "POLL_NOT_FOUND", message: "Poll not found" });
          return;
        }
        throw err;
      }
    });
  });
};
