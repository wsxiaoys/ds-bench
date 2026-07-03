import { match, scope, type } from 'arktype';

// Use scope.module - it's a static method
const myModule = (scope as any).module({
  success: { status: '"success"', data: 'object' },
  error: { status: '"error"', code: 'number', reason: 'string' },
  pending: { status: '"pending"' },
});

console.log('module type:', typeof myModule);
console.log('module keys:', Object.keys(myModule));

const input = { status: 'success', data: { name: 'Alice' } };

// Try using the module with match - using dot notation
try {
  const result = match({
    'myModule.success': (data: any) => `OK: ${JSON.stringify(data.data)}`,
    'myModule.error': (e: any) => `ERR ${e.code} ${e.reason}`,
    'myModule.pending': () => `PENDING`,
    default: 'assert'
  } as any)(input);
  console.log('Result:', result);
} catch (e: any) {
  console.log('Error:', e.message);
}
