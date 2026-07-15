import assert from 'assert';

async function runTests() {
  console.log('Starting integration tests...');

  // 1. Sign up user1
  const signupRes = await fetch('http://localhost:3001/auth/username/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user1', password: 'password123' })
  });
  console.log('Signup status:', signupRes.status);
  if (signupRes.status !== 200 && signupRes.status !== 201) {
    const signupText = await signupRes.text();
    console.log('Signup failed or user already exists:', signupText);
  }

  // 2. Log in user1
  const loginRes = await fetch('http://localhost:3001/auth/username/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user1', password: 'password123' })
  });
  console.log('Login status:', loginRes.status);
  assert.strictEqual(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.sessionId, 'sessionId should be present');
  const sessionId1 = loginData.sessionId;
  console.log('Logged in as user1, sessionId:', sessionId1);

  // 3. Upload a file as user1
  const formData = new FormData();
  const fileContent = 'Hello, this is a test file content!';
  formData.append('file', new Blob([fileContent], { type: 'text/plain' }), 'testfile.txt');

  const uploadRes = await fetch('http://localhost:3001/api/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionId1}`
    },
    body: formData
  });
  console.log('Upload status:', uploadRes.status);
  assert.strictEqual(uploadRes.status, 201);
  const uploadData = await uploadRes.json();
  console.log('Upload response:', uploadData);
  assert.ok(uploadData.id, 'id should be present');
  assert.strictEqual(uploadData.filename, 'testfile.txt');
  assert.strictEqual(uploadData.size, fileContent.length);
  const fileId = uploadData.id;

  // 4. Query my files as user1
  const queryRes = await fetch('http://localhost:3001/operations/get-my-files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionId1}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  console.log('Query status:', queryRes.status);
  assert.strictEqual(queryRes.status, 200);
  const queryData = await queryRes.json();
  console.log('Query response:', JSON.stringify(queryData, null, 2));
  const filesList = queryData.json || queryData;
  assert.ok(Array.isArray(filesList), 'Query response should be an array under json or top-level');
  const uploadedFile = filesList.find(f => f.id === fileId);
  assert.ok(uploadedFile, 'Uploaded file should be in the list');
  assert.strictEqual(uploadedFile.filename, 'testfile.txt');
  assert.strictEqual(uploadedFile.size, fileContent.length);

  // 5. Download the file as user1
  const downloadRes = await fetch(`http://localhost:3001/api/files/${fileId}/download`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionId1}`
    }
  });
  console.log('Download status:', downloadRes.status);
  assert.strictEqual(downloadRes.status, 200);
  const downloadedContent = await downloadRes.text();
  assert.strictEqual(downloadedContent, fileContent, 'Downloaded content should match original content');
  console.log('Download content matches original!');

  // 6. Test unauthorized download (no token)
  const downloadNoAuthRes = await fetch(`http://localhost:3001/api/files/${fileId}/download`, {
    method: 'GET'
  });
  console.log('Download no auth status:', downloadNoAuthRes.status);
  assert.strictEqual(downloadNoAuthRes.status, 401);

  // 7. Test unauthorized upload (no token)
  const uploadNoAuthRes = await fetch('http://localhost:3001/api/files/upload', {
    method: 'POST',
    body: formData
  });
  console.log('Upload no auth status:', uploadNoAuthRes.status);
  assert.strictEqual(uploadNoAuthRes.status, 401);

  // 8. Sign up and log in user2
  const signup2Res = await fetch('http://localhost:3001/auth/username/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user2', password: 'password123' })
  });
  if (signup2Res.status !== 200 && signup2Res.status !== 201) {
    console.log('User2 already exists or signup failed');
  }
  const login2Res = await fetch('http://localhost:3001/auth/username/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user2', password: 'password123' })
  });
  assert.strictEqual(login2Res.status, 200);
  const login2Data = await login2Res.json();
  const sessionId2 = login2Data.sessionId;

  // 9. Test downloading user1's file as user2 (should be 403 Forbidden)
  const downloadForbiddenRes = await fetch(`http://localhost:3001/api/files/${fileId}/download`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionId2}`
    }
  });
  console.log('Download by other user status:', downloadForbiddenRes.status);
  assert.strictEqual(downloadForbiddenRes.status, 403);

  // 10. Test downloading non-existent file (should be 404 Not Found)
  const downloadNotFoundRes = await fetch(`http://localhost:3001/api/files/9999/download`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionId1}`
    }
  });
  console.log('Download non-existent file status:', downloadNotFoundRes.status);
  assert.strictEqual(downloadNotFoundRes.status, 404);

  console.log('All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
