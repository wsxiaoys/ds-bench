const { AlchemystAI } = require('@alchemystai/sdk');
const alchemyst = new AlchemystAI({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
alchemyst.v1.context.add({
  context_type: 'resource',
  documents: [{ content: 'test' }],
  scope: 'internal',
  source: 'test',
  metadata: { fileName: 'test.md', file_name: 'test.md', fileSize: 4, fileType: 'text/markdown', lastModified: new Date().toISOString() }
}).then(console.log).catch(console.error);
