import { writeFileSync } from 'node:fs';
writeFileSync('/tmp/test-output.log', 'Hello\n', 'utf8');
console.log('Wrote test-output.log');