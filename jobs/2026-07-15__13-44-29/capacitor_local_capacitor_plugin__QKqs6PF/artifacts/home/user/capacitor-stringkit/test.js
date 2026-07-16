const assert = require('assert');

async function runTests() {
  console.log('Running tests...');

  // 1. Test CommonJS bundle
  console.log('Testing CommonJS bundle...');
  const { StringKit } = require('./dist/plugin.cjs.js');
  
  assert.ok(StringKit, 'StringKit should be defined');
  assert.strictEqual(typeof StringKit.echo, 'function', 'echo should be a function');
  assert.strictEqual(typeof StringKit.reverse, 'function', 'reverse should be a function');
  assert.strictEqual(typeof StringKit.slugify, 'function', 'slugify should be a function');

  // Test echo
  const echoRes = await StringKit.echo({ value: 'hello' });
  assert.deepStrictEqual(echoRes, { value: 'hello' });
  console.log('  CJS echo passed');

  // Test reverse
  const reverseRes = await StringKit.reverse({ value: 'abcde' });
  assert.deepStrictEqual(reverseRes, { value: 'edcba' });
  console.log('  CJS reverse passed');

  // Test slugify
  const slugifyRes1 = await StringKit.slugify({ value: '  Hello, World! 123 ' });
  assert.deepStrictEqual(slugifyRes1, { slug: 'hello-world-123' });
  
  const slugifyRes2 = await StringKit.slugify({ value: '---Hello---' });
  assert.deepStrictEqual(slugifyRes2, { slug: 'hello' });
  
  const slugifyRes3 = await StringKit.slugify({ value: '!!!' });
  assert.deepStrictEqual(slugifyRes3, { slug: '' });
  console.log('  CJS slugify passed');

  // 2. Test ESM web build
  console.log('Testing ESM web build...');
  const { StringKitWeb } = await import('./dist/esm/web.js');
  const webInstance = new StringKitWeb();

  // Test echo
  const esmEchoRes = await webInstance.echo({ value: 'hello' });
  assert.deepStrictEqual(esmEchoRes, { value: 'hello' });
  console.log('  ESM echo passed');

  // Test reverse
  const esmReverseRes = await webInstance.reverse({ value: 'abcde' });
  assert.deepStrictEqual(esmReverseRes, { value: 'edcba' });
  console.log('  ESM reverse passed');

  // Test slugify
  const esmSlugifyRes1 = await webInstance.slugify({ value: '  Hello, World! 123 ' });
  assert.deepStrictEqual(esmSlugifyRes1, { slug: 'hello-world-123' });
  console.log('  ESM slugify passed');

  console.log('All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
