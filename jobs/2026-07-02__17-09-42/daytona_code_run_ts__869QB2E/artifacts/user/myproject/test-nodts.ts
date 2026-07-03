import { writeFileSync } from 'node:fs';
writeFileSync('/tmp/output-test.log', 'Hello from plain ts\n', 'utf8');
console.log('Wrote /tmp/output-test.log');
// Sleep 10 seconds to give npm notice time to print
await new Promise(resolve => setTimeout(resolve, 10000));
console.log('Done sleeping');
