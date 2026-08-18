import { JSDOM } from 'jsdom';

async function run() {
  console.log('--- Running Concurrency Tests ---');

  // Fetch home page to get action URL and initial count
  let res = await fetch('http://localhost:3000/');
  let html = await res.text();
  let dom = new JSDOM(html);
  let doc = dom.window.document;

  const form = doc.querySelector('form[data-testid="reply-form"]');
  const actionUrl = form.getAttribute('action');
  const fullActionUrl = new URL(actionUrl, 'http://localhost:3000/').toString();

  const initialCount = doc.querySelectorAll('[data-testid="comment"]').length;
  console.log(`Initial comment count before concurrency: ${initialCount}`);

  // Submit 5 valid replies concurrently
  console.log('Submitting 5 valid replies concurrently...');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      fetch(fullActionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          parentId: '1',
          author: `concurrent_user_${i}`,
          body: `Concurrent body ${i}`,
        }),
      })
    );
  }

  // Wait for all submissions to complete
  const responses = await Promise.all(promises);
  console.log('All 5 concurrent requests completed.');

  // Fetch the page again to count comments
  const finalRes = await fetch('http://localhost:3000/');
  const finalHtml = await finalRes.text();
  const finalDom = new JSDOM(finalHtml);
  const finalDoc = finalDom.window.document;

  const finalComments = finalDoc.querySelectorAll('[data-testid="comment"]');
  console.log(`Final comment count after concurrency: ${finalComments.length}`);

  const expectedCount = initialCount + 5;
  if (finalComments.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} comments, but found ${finalComments.length}`);
  }

  // Verify each concurrent comment exists
  for (let i = 0; i < 5; i++) {
    const author = `concurrent_user_${i}`;
    const body = `Concurrent body ${i}`;
    
    // Find comment by author and body
    const found = Array.from(finalComments).some(c => {
      const text = c.textContent || '';
      return text.includes(author) && text.includes(body);
    });

    if (!found) {
      throw new Error(`Could not find concurrent comment by author ${author}`);
    }
  }

  console.log('Concurrency test passed perfectly! All concurrent requests were persisted and rendered.');
}

run().catch(err => {
  console.error('Concurrency test failed:', err);
  process.exit(1);
});
