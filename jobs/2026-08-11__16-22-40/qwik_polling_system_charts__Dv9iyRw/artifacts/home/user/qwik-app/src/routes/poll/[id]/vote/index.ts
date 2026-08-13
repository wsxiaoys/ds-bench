import type { RequestHandler } from '@builder.io/qwik-city';
import { getOptions, castVoteTransaction, getPoll } from '../../../../db';

export const onPost: RequestHandler = async (event) => {
  const pollId = event.params.id;

  // 1. Check if the poll exists
  const poll = getPoll(pollId);
  if (!poll) {
    event.json(404, { error: 'Poll or option not found' });
    return;
  }

  // 2. Parse request body
  let optionId: any;
  try {
    const body = await event.request.json() as { optionId?: any };
    optionId = body?.optionId;
  } catch {
    event.json(400, { error: 'Invalid option ID' });
    return;
  }

  if (optionId === undefined || optionId === null || typeof optionId !== 'number' || isNaN(optionId)) {
    event.json(400, { error: 'Invalid option ID' });
    return;
  }

  // 3. Get client IP
  const xForwardedFor = event.request.headers.get('x-forwarded-for');
  let ip = '127.0.0.1';
  if (xForwardedFor) {
    const parts = xForwardedFor.split(',');
    if (parts[0]) {
      ip = parts[0].trim();
    }
  } else if (event.clientConn?.ip) {
    ip = event.clientConn.ip;
  }

  const now = Date.now();

  // 4. Perform vote inside transaction
  const result = castVoteTransaction(pollId, optionId, ip, now);

  if (result.error === 'rate_limit') {
    event.json(429, { error: 'Rate limit exceeded' });
    return;
  }

  if (result.error === 'not_found') {
    event.json(404, { error: 'Poll or option not found' });
    return;
  }

  // 5. Fetch updated options
  const options = getOptions(pollId);
  const votesObj: Record<string, number> = {};
  for (const opt of options) {
    votesObj[String(opt.id)] = opt.votes;
  }

  event.json(200, {
    success: true,
    votes: votesObj,
  });
};
