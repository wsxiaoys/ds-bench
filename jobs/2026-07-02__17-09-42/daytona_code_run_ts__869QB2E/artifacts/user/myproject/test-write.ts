import { writeFileSync } from 'node:fs';
writeFileSync('/home/user/myproject/test-ts.log', 'Hello from TS\n', 'utf8');
console.log('Wrote test-ts.log');