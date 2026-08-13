import { JSDOM } from 'jsdom';

async function run() {
  console.log('--- Running Submission Tests ---');

  // 1. Fetch home page to get the action URL
  let res = await fetch('http://localhost:3000/');
  let html = await res.text();
  let dom = new JSDOM(html);
  let doc = dom.window.document;

  const form = doc.querySelector('form[data-testid="reply-form"]');
  if (!form) {
    throw new Error('Could not find any reply form on the page');
  }

  const actionUrl = form.getAttribute('action');
  console.log('Action URL:', actionUrl);

  const fullActionUrl = new URL(actionUrl, 'http://localhost:3000/').toString();
  console.log('Full Action URL:', fullActionUrl);

  // 2. Submit a valid reply to Alice (comment 1)
  console.log('Submitting a valid reply to Alice (ID 1)...');
  let postRes = await fetch(fullActionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      parentId: '1',
      author: 'david',
      body: 'I agree too!',
    }),
  });

  // Since it's a form submission, Qwik City might redirect or return the page HTML.
  // Let's get the HTML of the response or fetch the page again.
  let postHtml = await postRes.text();
  let postDom = new JSDOM(postHtml);
  let postDoc = postDom.window.document;

  // Let's verify if the comment is rendered on the page now.
  let comments = Array.from(postDoc.querySelectorAll('[data-testid="comment"]'));
  console.log(`After valid submission, found ${comments.length} comments.`);

  const newComment = comments.find(c => c.getAttribute('data-comment-id') === '5');
  if (!newComment) {
    throw new Error('New comment with ID 5 was not found in the rendered page after submission');
  }

  if (newComment.getAttribute('data-parent-id') !== '1') {
    throw new Error(`Expected parent-id "1", got "${newComment.getAttribute('data-parent-id')}"`);
  }
  if (newComment.getAttribute('data-depth') !== '1') {
    throw new Error(`Expected depth "1", got "${newComment.getAttribute('data-depth')}"`);
  }
  if (!newComment.textContent.includes('david') || !newComment.textContent.includes('I agree too!')) {
    throw new Error('New comment does not contain correct author and body text');
  }

  // Check DOM nesting: comment 5 must be nested inside comment 1
  const aliceEl = postDoc.querySelector('[data-comment-id="1"]');
  if (!aliceEl.contains(newComment)) {
    throw new Error('New comment (ID 5) is not a DOM descendant of Alice comment (ID 1)');
  }
  console.log('Valid reply submitted and verified successfully!');

  // 3. Submit an invalid reply (author length < 2)
  console.log('Submitting an invalid reply (author too short)...');
  let invalidRes = await fetch(fullActionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      parentId: '1',
      author: 'x',
      body: 'Too short author',
    }),
  });

  let invalidHtml = await invalidRes.text();
  let invalidDom = new JSDOM(invalidHtml);
  let invalidDoc = invalidDom.window.document;

  const errorEl = invalidDoc.querySelector('[data-testid="error"]');
  if (!errorEl) {
    throw new Error('Expected data-testid="error" element for validation failure, but none was found');
  }
  console.log('Error message found:', errorEl.textContent.trim());

  // Verify that no new comment was added (total comments should still be 5)
  let commentsAfterInvalid = Array.from(invalidDoc.querySelectorAll('[data-testid="comment"]'));
  if (commentsAfterInvalid.length !== 5) {
    throw new Error(`Expected 5 comments after invalid submission, but found ${commentsAfterInvalid.length}`);
  }
  console.log('Invalid reply handled and verified successfully!');

  // 4. Submit with non-existent parentId
  console.log('Submitting a reply with non-existent parentId...');
  let badParentRes = await fetch(fullActionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      parentId: '9999',
      author: 'stranger',
      body: 'Hello?',
    }),
  });

  let badParentHtml = await badParentRes.text();
  let badParentDom = new JSDOM(badParentHtml);
  let badParentDoc = badParentDom.window.document;

  const badParentErrorEl = badParentDoc.querySelector('[data-testid="error"]');
  if (!badParentErrorEl) {
    throw new Error('Expected data-testid="error" element for non-existent parent ID, but none was found');
  }
  console.log('Error message for non-existent parent found:', badParentErrorEl.textContent.trim());

  // Verify that no new comment was added (total comments should still be 5)
  let commentsAfterBadParent = Array.from(badParentDoc.querySelectorAll('[data-testid="comment"]'));
  if (commentsAfterBadParent.length !== 5) {
    throw new Error(`Expected 5 comments after bad parent submission, but found ${commentsAfterBadParent.length}`);
  }
  console.log('Non-existent parent ID handled and verified successfully!');

  console.log('All submission tests passed perfectly!');
}

run().catch(err => {
  console.error('Submission tests failed:', err);
  process.exit(1);
});
