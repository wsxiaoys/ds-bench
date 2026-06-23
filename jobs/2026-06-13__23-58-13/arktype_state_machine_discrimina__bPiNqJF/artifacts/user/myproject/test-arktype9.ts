import { type } from "arktype";
const State = type({ status: "'idle'" }).or({ status: "'loading'" });
console.log(State.json);
