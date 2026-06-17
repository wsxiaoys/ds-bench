import { type } from 'arktype';

const schema = type({
    username: "/^[a-zA-Z0-9]{3,20}$/",
    email: "string.email",
    "age?": "number.integer >= 13 <= 120"
});

const querySchema = type({
    q: "string >= 1 <= 100",
    page: "string.numeric.parse |> number.integer >= 1",
    limit: "string.numeric.parse |> number.integer >= 1 <= 50"
});

console.log(schema({
    username: "abc12",
    email: "test@example.com"
}));

console.log(querySchema({
    q: "hello",
    page: "2",
    limit: "10"
}));
