import { type } from 'arktype';

const schema = type({
    username: "string.alphanumeric >= 3 <= 20",
});

console.log(schema({
    username: "abc12",
}));
