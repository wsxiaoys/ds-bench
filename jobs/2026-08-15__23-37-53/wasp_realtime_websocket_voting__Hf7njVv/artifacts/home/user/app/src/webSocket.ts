import { type WebSocketDefinition } from "wasp/server/webSocket";
import { prisma } from "wasp/server";

export const webSocketFn: WebSocketDefinition = (io, context) => {
  io.on("connection", (socket) => {
    // Helper to send errors
    const sendError = (code: string, message: string) => {
      socket.emit("poll:error", { code, message });
    };

    // helper to send personalized state to a socket
    const sendPersonalizedState = async (sock: any, slug: string) => {
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

      if (!poll) return;

      const userId = sock.data.user?.id;
      let totalVotes = 0;
      let myVoteOptionId: number | null = null;

      const optionResults = poll.options.map((opt: any) => {
        const votesCount = opt.votes.length;
        totalVotes += votesCount;

        const hasMyVote = opt.votes.some((v: any) => v.userId === userId);
        if (hasMyVote) {
          myVoteOptionId = opt.id;
        }

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

      sock.emit("poll:state", {
        slug: poll.slug,
        question: poll.question,
        isClosed: poll.isClosed,
        revision: poll.revision,
        totalVotes,
        leaderOptionId,
        myVoteOptionId,
        options: optionResults,
      });
    };

    // helper to broadcast personalized state to all subscribers of a poll
    const broadcastState = async (slug: string) => {
      const sockets = await io.in(slug).fetchSockets();
      await Promise.all(sockets.map((s) => sendPersonalizedState(s, slug)));
    };

    // 1. poll:subscribe
    socket.on("poll:subscribe", async (payload: any) => {
      if (!socket.data.user) {
        return sendError("UNAUTHENTICATED", "You must be authenticated to perform this action.");
      }

      if (!payload || typeof payload !== "object" || typeof payload.slug !== "string" || payload.slug === "") {
        return sendError("INVALID_PAYLOAD", "Invalid subscribe payload.");
      }

      const poll = await context.entities.Poll.findUnique({
        where: { slug: payload.slug },
      });

      if (!poll) {
        return sendError("POLL_NOT_FOUND", "The requested poll was not found.");
      }

      socket.join(payload.slug);
      await sendPersonalizedState(socket, payload.slug);
    });

    // 2. poll:unsubscribe
    socket.on("poll:unsubscribe", async (payload: any) => {
      if (!socket.data.user) {
        return sendError("UNAUTHENTICATED", "You must be authenticated to perform this action.");
      }

      if (!payload || typeof payload !== "object" || typeof payload.slug !== "string" || payload.slug === "") {
        return sendError("INVALID_PAYLOAD", "Invalid unsubscribe payload.");
      }

      const poll = await context.entities.Poll.findUnique({
        where: { slug: payload.slug },
      });

      if (!poll) {
        return sendError("POLL_NOT_FOUND", "The requested poll was not found.");
      }

      socket.leave(payload.slug);
    });

    // 3. poll:vote
    socket.on("poll:vote", async (payload: any) => {
      if (!socket.data.user) {
        return sendError("UNAUTHENTICATED", "You must be authenticated to perform this action.");
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        typeof payload.slug !== "string" ||
        payload.slug === "" ||
        typeof payload.optionId !== "number" ||
        !Number.isInteger(payload.optionId)
      ) {
        return sendError("INVALID_PAYLOAD", "Invalid vote payload.");
      }

      const { slug, optionId } = payload;

      const poll = await context.entities.Poll.findUnique({
        where: { slug },
        include: {
          options: true,
        },
      });

      if (!poll) {
        return sendError("POLL_NOT_FOUND", "The requested poll was not found.");
      }

      // Check if socket is subscribed (i.e. in the room)
      if (!socket.rooms.has(slug)) {
        return sendError("NOT_SUBSCRIBED", "You are not subscribed to this poll.");
      }

      if (poll.isClosed) {
        return sendError("POLL_CLOSED", "This poll is closed.");
      }

      const optionExists = poll.options.some((o) => o.id === optionId);
      if (!optionExists) {
        return sendError("OPTION_NOT_FOUND", "The selected option does not exist in this poll.");
      }

      // Check existing vote
      const existingVote = await context.entities.Vote.findUnique({
        where: {
          pollId_userId: {
            pollId: poll.id,
            userId: socket.data.user.id,
          },
        },
      });

      if (existingVote) {
        if (existingVote.optionId === optionId) {
          // No-op
          return await sendPersonalizedState(socket, slug);
        } else {
          // Change vote
          await prisma.$transaction([
            prisma.vote.update({
              where: { id: existingVote.id },
              data: { optionId },
            }),
            prisma.poll.update({
              where: { id: poll.id },
              data: { revision: { increment: 1 } },
            }),
          ]);
        }
      } else {
        // New vote
        await prisma.$transaction([
          prisma.vote.create({
            data: {
              pollId: poll.id,
              optionId,
              userId: socket.data.user.id,
            },
          }),
          prisma.poll.update({
            where: { id: poll.id },
            data: { revision: { increment: 1 } },
          }),
        ]);
      }

      await broadcastState(slug);
    });

    // 4. poll:retract
    socket.on("poll:retract", async (payload: any) => {
      if (!socket.data.user) {
        return sendError("UNAUTHENTICATED", "You must be authenticated to perform this action.");
      }

      if (!payload || typeof payload !== "object" || typeof payload.slug !== "string" || payload.slug === "") {
        return sendError("INVALID_PAYLOAD", "Invalid retract payload.");
      }

      const { slug } = payload;

      const poll = await context.entities.Poll.findUnique({
        where: { slug },
      });

      if (!poll) {
        return sendError("POLL_NOT_FOUND", "The requested poll was not found.");
      }

      if (!socket.rooms.has(slug)) {
        return sendError("NOT_SUBSCRIBED", "You are not subscribed to this poll.");
      }

      if (poll.isClosed) {
        return sendError("POLL_CLOSED", "This poll is closed.");
      }

      const existingVote = await context.entities.Vote.findUnique({
        where: {
          pollId_userId: {
            pollId: poll.id,
            userId: socket.data.user.id,
          },
        },
      });

      if (!existingVote) {
        return sendError("NO_ACTIVE_VOTE", "You have not voted in this poll.");
      }

      await prisma.$transaction([
        prisma.vote.delete({
          where: { id: existingVote.id },
        }),
        prisma.poll.update({
          where: { id: poll.id },
          data: { revision: { increment: 1 } },
        }),
      ]);

      await broadcastState(slug);
    });

    // 5. poll:close
    socket.on("poll:close", async (payload: any) => {
      if (!socket.data.user) {
        return sendError("UNAUTHENTICATED", "You must be authenticated to perform this action.");
      }

      if (!payload || typeof payload !== "object" || typeof payload.slug !== "string" || payload.slug === "") {
        return sendError("INVALID_PAYLOAD", "Invalid close payload.");
      }

      const { slug } = payload;

      const poll = await context.entities.Poll.findUnique({
        where: { slug },
      });

      if (!poll) {
        return sendError("POLL_NOT_FOUND", "The requested poll was not found.");
      }

      if (!socket.rooms.has(slug)) {
        return sendError("NOT_SUBSCRIBED", "You are not subscribed to this poll.");
      }

      if (poll.creatorId !== socket.data.user.id) {
        return sendError("NOT_POLL_CREATOR", "Only the poll creator can close it.");
      }

      if (poll.isClosed) {
        return sendError("ALREADY_CLOSED", "The poll is already closed.");
      }

      await prisma.$transaction([
        prisma.poll.update({
          where: { id: poll.id },
          data: {
            isClosed: true,
            revision: { increment: 1 },
          },
        }),
      ]);

      await broadcastState(slug);
    });
  });
};
