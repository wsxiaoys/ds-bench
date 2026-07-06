const { EventSource } = require('eventsource');
globalThis.EventSource = EventSource;
const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090');
pb.REDACTEDCancellation(false);
(async () => {
  await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
  const token = pb.authStore.token;
  console.log('Token:', token ? token.slice(0,30)+'...' : 'none');
  
  // Connect to SSE directly and listen.
  const url = pb.buildURL('/api/realtime');
  console.log('URL:', url);
  const es = new EventSource(url, {
    headers: { 'Authorization': token }
  });
  
  es.onopen = () => console.log('OPENED');
  es.onerror = (e) => console.log('ERROR', e?.message || e, 'status:', e?.status);
  es.onmessage = (e) => console.log('MSG:', e.data, 'id:', e.lastEventId, 'event:', e.type);
  es.addEventListener('PB_CONNECT', (e) => {
    console.log('PB_CONNECT:', e.data, 'lastId:', e.lastEventId);
    const clientId = e.lastEventId;
    
    // Subscribe to messages with filter via POST.
    const opts = encodeURIComponent(JSON.stringify({query:{filter:"chat='chat-123'"}}));
    fetch(pb.buildURL('/api/realtime'), {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': token },
      body: JSON.stringify({ clientId, subscriptions: [`messages?options=${opts}`] })
    })
    .then(r => r.text()).then(t => console.log('SUB RESP:', t))
    .catch(e => console.log('SUB ERR:', e.message));
  });
  
  setTimeout(async () => {
    const r = await pb.collection('messages').create({ chat: 'chat-123', body: 'matching 6' });
    console.log('created', r.id);
  }, 4000);
  
  setTimeout(() => process.exit(0), 12000);
})().catch(e => { console.error('ERR', e?.message || e); process.exit(1); });
