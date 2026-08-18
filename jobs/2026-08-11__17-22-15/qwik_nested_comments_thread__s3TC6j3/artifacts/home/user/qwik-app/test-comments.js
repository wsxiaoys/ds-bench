import { JSDOM } from 'jsdom';

async function runTests() {
  console.log('Starting comment system tests...');

  // 1. Fetch the home page
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // 2. Find all comments
  const comments = Array.from(doc.querySelectorAll('[data-testid="comment"]'));
  console.log(`Found ${comments.length} comments.`);

  if (comments.length !== 4) {
    throw new Error(`Expected exactly 4 comments seeded, but found ${comments.length}`);
  }

  // 3. Verify each seeded comment attributes and content
  const expectedSeeded = [
    { id: '1', parentId: '', depth: '0', author: 'alice', body: 'Great article!' },
    { id: '2', parentId: '1', depth: '1', author: 'bob', body: 'I agree.' },
    { id: '3', parentId: '2', depth: '2', author: 'carol', body: 'Well said.' },
    { id: '4', parentId: '', depth: '0', author: 'dave', body: 'Any updates?' },
  ];

  for (const expected of expectedSeeded) {
    const el = comments.find(c => c.getAttribute('data-comment-id') === expected.id);
    if (!el) {
      throw new Error(`Could not find comment with id ${expected.id}`);
    }

    const parentId = el.getAttribute('data-parent-id');
    const depth = el.getAttribute('data-depth');
    
    if (parentId !== expected.parentId) {
      throw new Error(`Comment ${expected.id}: expected data-parent-id="${expected.parentId}", got "${parentId}"`);
    }
    if (depth !== expected.depth) {
      throw new Error(`Comment ${expected.id}: expected data-depth="${expected.depth}", got "${depth}"`);
    }

    const text = el.textContent || '';
    if (!text.includes(expected.author)) {
      throw new Error(`Comment ${expected.id} does not contain author "${expected.author}"`);
    }
    if (!text.includes(expected.body)) {
      throw new Error(`Comment ${expected.id} does not contain body "${expected.body}"`);
    }

    console.log(`Comment ${expected.id} is correct.`);
  }

  // 4. Verify DOM nesting (child comment must be a descendant of parent comment)
  const bobEl = doc.querySelector('[data-comment-id="2"]');
  const aliceEl = doc.querySelector('[data-comment-id="1"]');
  if (!aliceEl.contains(bobEl)) {
    throw new Error('Comment 2 (bob) is not a DOM descendant of Comment 1 (alice)');
  }
  const carolEl = doc.querySelector('[data-comment-id="3"]');
  if (!bobEl.contains(carolEl)) {
    throw new Error('Comment 3 (carol) is not a DOM descendant of Comment 2 (bob)');
  }
  console.log('DOM nesting verified successfully!');

  // 5. Verify reply forms
  const forms = Array.from(doc.querySelectorAll('form[data-testid="reply-form"]'));
  console.log(`Found ${forms.length} reply forms.`);

  // There should be 5 forms: 1 for each of the 4 comments, plus 1 for the new root comment.
  if (forms.length !== 5) {
    throw new Error(`Expected exactly 5 reply forms, but found ${forms.length}`);
  }

  for (const form of forms) {
    const parentIdAttr = form.getAttribute('data-parent-id');
    const parentIdInput = form.querySelector('input[name="parentId"]');
    const authorInput = form.querySelector('input[name="author"]');
    const bodyInput = form.querySelector('input[name="body"], textarea[name="body"]');

    if (parentIdAttr === null) {
      throw new Error('Form is missing data-parent-id attribute');
    }
    if (!parentIdInput) {
      throw new Error(`Form for parent-id "${parentIdAttr}" is missing hidden input "parentId"`);
    }
    if (!authorInput) {
      throw new Error(`Form for parent-id "${parentIdAttr}" is missing text input "author"`);
    }
    if (!bodyInput) {
      throw new Error(`Form for parent-id "${parentIdAttr}" is missing input/textarea "body"`);
    }

    console.log(`Form for parent-id "${parentIdAttr}" is valid.`);
  }

  console.log('All initial tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
