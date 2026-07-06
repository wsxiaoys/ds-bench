import { writeFileSync } from 'node:fs';
writeFileSync('/home/user/myproject/test.log', 'Hello\n', 'utf8');
console.log('Wrote test.log');