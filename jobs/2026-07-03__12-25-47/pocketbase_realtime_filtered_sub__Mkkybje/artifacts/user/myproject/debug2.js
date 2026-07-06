const { EventSource } = require('eventsource');
globalThis.EventSource = EventSource;
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090');
(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  console.log('authed');
  const unsub = await pb.collection('messages').subscribe('*', (e) => {
    console.log('EVENT:', JSON.stringify(e));
  }, { filter: "chat='chat-123'" });
  console.log('Subscribed with filter');
  setTimeout(async () => {
    const r = await pb.collection('messages').create({ chat: 'chat-123', body: 'matching' });
    console.log('created matching', r.id);
    const r2 = await pb.collection('messages').create({ chat: 'chat-OTHER', body: 'non-matching' });
    console.log('created non-matching', r2.id);
  }, 2000);
  setTimeout(() => { unsub(); process.exit(0); }, 8000);
})().catch(e => { console.error('ERR', e?.message || e); process.exit(1); });
