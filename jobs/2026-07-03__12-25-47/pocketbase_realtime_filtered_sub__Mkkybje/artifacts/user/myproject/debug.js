const { EventSource } = require('eventsource');
globalThis.EventSource = EventSource;
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090');
(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  console.log('authed');
  // Inspect the realtime service
  console.log('Realtime:', !!pb.realtime);
  console.log('Has subscribe:', typeof pb.realtime.subscribe);
  // Subscribe
  const unsub = await pb.realtime.subscribe('messages', (e) => {
    console.log('EVENT:', JSON.stringify(e));
  });
  console.log('Subscribed');
  setTimeout(async () => {
    const r = await pb.collection('messages').create({ chat: 'chat-123', body: 'after sub' });
    console.log('created', r.id);
  }, 2000);
  setTimeout(() => { unsub(); process.exit(0); }, 8000);
})().catch(e => { console.error('ERR', e?.message || e); process.exit(1); });
