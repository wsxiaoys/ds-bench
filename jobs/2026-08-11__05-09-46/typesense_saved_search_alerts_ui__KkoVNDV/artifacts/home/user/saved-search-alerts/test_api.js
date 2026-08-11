const assert = require('assert');

async function test() {
  const baseUrl = 'http://127.0.0.1:8080';
  console.log('Starting integration tests on:', baseUrl);

  try {
    // 1. GET /api/saved-searches (should be empty initially)
    let res = await fetch(`${baseUrl}/api/saved-searches`);
    assert.strictEqual(res.status, 200, 'GET /api/saved-searches should return 200');
    let searches = await res.json();
    assert.ok(Array.isArray(searches), 'Should return an array');
    assert.strictEqual(searches.length, 0, 'Should be empty initially');
    console.log('✓ Initial empty state checked.');

    // 2. POST /api/saved-searches (Create first search: Wireless)
    res = await fetch(`${baseUrl}/api/saved-searches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Wireless Products',
        q: 'Wireless',
        category: '',
        max_price: null
      })
    });
    assert.strictEqual(res.status, 201, 'POST should return 201');
    const ss1 = await res.json();
    assert.strictEqual(ss1.name, 'Wireless Products');
    assert.strictEqual(ss1.q, 'Wireless');
    assert.strictEqual(ss1.category, '');
    assert.strictEqual(ss1.max_price, null);
    assert.strictEqual(ss1.match_count, null);
    assert.strictEqual(ss1.new_count, null);
    assert.ok(typeof ss1.id === 'string', 'Should have a string ID');
    console.log('✓ Saved search creation checked.');

    // 3. POST /api/saved-searches/{id}/check (First check for ss1)
    res = await fetch(`${baseUrl}/api/saved-searches/${ss1.id}/check`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200, 'POST check should return 200');
    const checked1 = await res.json();
    assert.strictEqual(checked1.id, ss1.id);
    assert.strictEqual(checked1.match_count, 1, 'Should match 1 product (Aurora Wireless Headphones)');
    assert.strictEqual(checked1.new_count, 0, 'First check should report 0 new matches');
    console.log('✓ Single search first check checked.');

    // 4. GET /api/saved-searches (Verify updated state)
    res = await fetch(`${baseUrl}/api/saved-searches`);
    searches = await res.json();
    assert.strictEqual(searches.length, 1);
    assert.strictEqual(searches[0].match_count, 1);
    assert.strictEqual(searches[0].new_count, 0);
    console.log('✓ GET saved-searches state verified.');

    // 5. POST /api/ingest (Ingest new matching product)
    res = await fetch(`${baseUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents: [
          {
            id: 'i1',
            name: 'Solaris Wireless Earbuds',
            category: 'electronics',
            price: 120
          }
        ]
      })
    });
    assert.strictEqual(res.status, 200, 'POST ingest should return 200');
    const ingestRes = await res.json();
    assert.strictEqual(ingestRes.ingested, 1);
    console.log('✓ Document ingestion checked.');

    // 6. POST /api/saved-searches/{id}/check (Second check for ss1 - should find 1 new product)
    res = await fetch(`${baseUrl}/api/saved-searches/${ss1.id}/check`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200);
    const checked2 = await res.json();
    assert.strictEqual(checked2.match_count, 2, 'Should match 2 products now');
    assert.strictEqual(checked2.new_count, 1, 'Should report 1 new match (Solaris Wireless Earbuds)');
    console.log('✓ Single search second check (new matches) checked.');

    // 7. POST /api/saved-searches/{id}/check (Third check immediately - should find 0 new products)
    res = await fetch(`${baseUrl}/api/saved-searches/${ss1.id}/check`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200);
    const checked3 = await res.json();
    assert.strictEqual(checked3.match_count, 2);
    assert.strictEqual(checked3.new_count, 0, 'Immediate re-check should report 0 new matches');
    console.log('✓ Single search third check (immediate re-check) checked.');

    // 8. POST /api/saved-searches (Create second search: Cheap Electronics)
    res = await fetch(`${baseUrl}/api/saved-searches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cheap Electronics',
        q: '',
        category: 'electronics',
        max_price: 100
      })
    });
    assert.strictEqual(res.status, 201);
    const ss2 = await res.json();
    assert.strictEqual(ss2.match_count, null);
    console.log('✓ Second saved search creation checked.');

    // 9. POST /api/check-all (Check all searches)
    res = await fetch(`${baseUrl}/api/check-all`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200);
    const allChecked = await res.json();
    assert.strictEqual(allChecked.length, 2);
    
    const checkedSs1 = allChecked.find(s => s.id === ss1.id);
    const checkedSs2 = allChecked.find(s => s.id === ss2.id);

    assert.ok(checkedSs1);
    assert.ok(checkedSs2);

    assert.strictEqual(checkedSs1.match_count, 2);
    assert.strictEqual(checkedSs1.new_count, 0, 'Should be 0 since checked just before');

    assert.strictEqual(checkedSs2.match_count, 1, 'Only Nimbus Bluetooth Speaker (89) matches electronics and <= 100');
    assert.strictEqual(checkedSs2.new_count, 0, 'First check of ss2 should report 0');
    console.log('✓ Check All Searches checked.');

    console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('\nTEST FAILED ❌');
    console.error(err);
    process.exit(1);
  }
}

test();
