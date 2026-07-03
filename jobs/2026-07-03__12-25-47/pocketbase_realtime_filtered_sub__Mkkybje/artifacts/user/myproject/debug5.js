const { EventSource } = require('eventsource');
globalThis.EventSource = EventSource;
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090');
pb.REDACTEDCancellation(false);
(async () => {
  // Hook request to inspect realtime.
  pb.beforeSend = function(url, opts) {
    if (url.includes('realtime')) {
      console.log('SEND:', url, 'METHOD:', opts.method, 'BODY:', JSON.stringify(opts.body).slice(0,300));
    }
    return {};
  };
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  console.log('authed');
  
  // Subscribe first using pb.realtime directly so we know clientId.
  const unsub = await pb.realtime.subscribe('messages', (e) => {
    console.log('RECEIVED EVENT:', JSON.stringify(e));
  }, { query: { filter: "chat='chat-123'" } });
  console.log('Subscribed');
  
  setTimeout(async () => {
    try {
      const r = await pb.collection('messages').create({ chat: 'chat-123', body: 'matching 5' });
      console.log('created matching', r.id);
    } catch (e) { console.error('create err:', e?.message); }
  }, 3000);
  
  setTimeout(() => { unsub(); process.exit(0); }, 10000);
})().catch(e => { console.error('ERR', e?.message || e); process.exit(1); });
