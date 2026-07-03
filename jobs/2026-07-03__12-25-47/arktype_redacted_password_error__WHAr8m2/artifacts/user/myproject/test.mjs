import { type } from 'arktype';

const T1 = type('3<=string.alphanumeric<=20');
console.log('3 char:', T1('abc'));
console.log('2 char:', T1('ab'));
console.log('4 char:', T1('abcd'));
console.log('20 char:', T1('abcdefghij1234567890'));
console.log('21 char:', T1('abcdefghij12345678901'));
console.log('non-alphanum 3 char:', T1('a@b'));
