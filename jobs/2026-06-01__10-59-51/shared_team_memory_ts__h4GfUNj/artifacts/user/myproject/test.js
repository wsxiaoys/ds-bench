const { AlchemystAI } = require('@alchemystai/sdk');
const client = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
client.v1.context.search({
  query: "Hello world",
  minimum_similarity_threshold: 0.1,
  similarity_threshold: 0.1,
  session_id: `team-standup-${process.env.ZEALT_RUN_ID}`
}).then(res => console.log(JSON.stringify(res))).catch(e => console.log(e.message));
