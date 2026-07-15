import assert from 'assert';

async function runTests() {
  console.log('Starting server endpoint tests...');

  // Reset the server log first
  const resetRes = await fetch('http://localhost:3000/api/reset', { method: 'POST' });
  const resetData = await resetRes.json();
  assert.strictEqual(resetRes.status, 200);
  assert.deepStrictEqual(resetData, { status: 'ok' });
  console.log('Reset endpoint works.');

  // Test GET /api/received on empty
  const getRes1 = await fetch('http://localhost:3000/api/received');
  const getData1 = await getRes1.json();
  assert.strictEqual(getRes1.status, 200);
  assert.deepStrictEqual(getData1, { messages: [] });
  console.log('GET /api/received (empty) works.');

  // Test POST /api/messages with failTimes = 2
  // Attempt 1: Should fail (503)
  const postRes1 = await fetch('http://localhost:3000/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'msg-1', body: 'hello', failTimes: 2 })
  });
  assert.strictEqual(postRes1.status, 503);
  const postData1 = await postRes1.json();
  assert.deepStrictEqual(postData1, { status: 'error' });
  console.log('Attempt 1 (failTimes=2) failed with 503 as expected.');

  // Attempt 2: Should fail (503)
  const postRes2 = await fetch('http://localhost:3000/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'msg-1', body: 'hello', failTimes: 2 })
  });
  assert.strictEqual(postRes2.status, 503);
  console.log('Attempt 2 (failTimes=2) failed with 503 as expected.');

  // Attempt 3: Should succeed (200)
  const postRes3 = await fetch('http://localhost:3000/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'msg-1', body: 'hello', failTimes: 2 })
  });
  assert.strictEqual(postRes3.status, 200);
  const postData3 = await postRes3.json();
  assert.deepStrictEqual(postData3, { status: 'ok', id: 'msg-1' });
  console.log('Attempt 3 (failTimes=2) succeeded with 200 as expected.');

  // Test GET /api/received to verify it contains msg-1
  const getRes2 = await fetch('http://localhost:3000/api/received');
  const getData2 = await getRes2.json();
  assert.strictEqual(getRes2.status, 200);
  assert.deepStrictEqual(getData2, { messages: [{ id: 'msg-1', body: 'hello' }] });
  console.log('GET /api/received contains msg-1.');

  // Test non-duplicate on server side (append on every successful delivery)
  const postRes4 = await fetch('http://localhost:3000/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'msg-1', body: 'hello', failTimes: 2 })
  });
  assert.strictEqual(postRes4.status, 200);
  
  const getRes3 = await fetch('http://localhost:3000/api/received');
  const getData3 = await getRes3.json();
  assert.strictEqual(getData3.messages.length, 2);
  assert.deepStrictEqual(getData3.messages[1], { id: 'msg-1', body: 'hello' });
  console.log('Server allows duplicate delivery and appends to received log.');

  console.log('All backend server tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
