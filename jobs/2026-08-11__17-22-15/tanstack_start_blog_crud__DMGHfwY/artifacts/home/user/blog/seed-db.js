import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('/home/user/blog/blog.db');
const db = new Database(dbPath);

console.log('Seeding database at:', dbPath);

// Insert posts
const insertStmt = db.prepare(`
  INSERT INTO posts (title, slug, body, tags, published)
  VALUES (?, ?, ?, ?, ?)
`);

// Post 1: Published
insertStmt.run(
  'First Post',
  'first-post',
  '# First Post\n\nThis is my **first post** written in Markdown.\n\n## Section 1\nHello world!',
  JSON.stringify(['test', 'intro']),
  1
);

// Post 2: Draft
insertStmt.run(
  'Second Post (Draft)',
  'second-post-draft',
  '# Second Post\n\nThis is a draft post. It should not be visible on the public list or detail page.',
  JSON.stringify(['test', 'draft']),
  0
);

// Post 3: Published with unique tag
insertStmt.run(
  'Third Post with Tag',
  'third-post-with-tag',
  '# Third Post\n\nThis post has a specific tag.',
  JSON.stringify(['tag-test']),
  1
);

console.log('Database seeded successfully!');
