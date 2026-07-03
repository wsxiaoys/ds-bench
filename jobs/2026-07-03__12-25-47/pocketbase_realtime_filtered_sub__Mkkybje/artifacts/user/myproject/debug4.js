const { EventSource } = require('eventsource');
globalThis.EventSource = EventSource;
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090');
pb.REDACTEDCancellation(false);
(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  console.log('authed');
  const unsub = await pb.collection('messages').subscribe('*', (e) => {
    console.log('EVENT:', JSON.stringify(e));
  }, { query: { filter: "chat='chat-123'" } });
  console.log('Subscribed with query.filter');
  
  // Wait for SSE to connect, then create.
  await new Promise(r => setTimeout(r, 3000));
  console.log('Creating matching message...');
  const r = await pb.collection('messages').create({ chat: 'chat-123', body: 'matching 4' });
  console.log('created matching', r.id);
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('Creating non-matching...');
  const r2 = await pb.collection('messages').create({ chat: 'chat-OTHER', body: 'non-matching 4' });
  console.log('created non-matching', r2.id);
  
  await new Promise(r => setTimeout(r, 3000));
  unsub(); 
  process.exit(0);
})().catch(e => { console.error('ERR', e?.message || e); process.exit(1); });
