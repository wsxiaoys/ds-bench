import type { RequestHandler } from '@builder.io/qwik-city';
import { castVoteTx } from '../../../../db';

export const onPost: RequestHandler = async ({ params, request, json, clientConn }) => {
  const pollId = params.id;
  
  // Parse body
  let body: any;
  try {
    body = await request.json();
  } catch {
    json(400, { error: "Invalid option ID" });
    return;
  }
  
  const optionId = body?.optionId;
  if (optionId === undefined || optionId === null || typeof optionId !== 'number' || isNaN(optionId)) {
    json(400, { error: "Invalid option ID" });
    return;
  }
  
  // Extract IP Address
  const xForwardedFor = request.headers.get('x-forwarded-for');
  let ip = '';
  if (xForwardedFor) {
    ip = xForwardedFor.split(',')[0].trim();
  } else {
    ip = clientConn.ip || '127.0.0.1';
  }
  
  const now = Date.now();
  const result = castVoteTx(pollId, optionId, ip, now);
  
  if (!result.success) {
    if (result.error === 'poll_not_found' || result.error === 'option_not_found') {
      json(404, { error: "Poll or option not found" });
      return;
    } else if (result.error === 'rate_limited') {
      json(429, { error: "Rate limit exceeded" });
      return;
    }
  }
  
  json(200, {
    success: true,
    votes: result.votes
  });
};
