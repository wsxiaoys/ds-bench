import { module } from "./src/schema.js";
import { ArkErrors } from "arktype";
const result = module.api.CreateUserRequest({ token: "short" });
console.log(result instanceof ArkErrors);
