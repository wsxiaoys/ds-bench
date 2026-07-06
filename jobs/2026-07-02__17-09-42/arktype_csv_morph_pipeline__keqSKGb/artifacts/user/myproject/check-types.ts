import { type } from "arktype";
import { Pipeline, type PipelineOutput } from "./src/pipeline.js";

// Type-level check: signupAt must be a Date
const sample: PipelineOutput = [
	{
		id: "550e8400-e29b-41d4-a716-446655440000",
		age: 30,
		email: "alice@example.com",
		signupAt: new Date()
	}
];

// Type assertions (compile-time only, the unused vars are fine)
const _signupAtIsDate: Date = sample[0].signupAt;
const _idIsString: string = sample[0].id;
const _ageIsNumber: number = sample[0].age;
const _emailIsString: string = sample[0].email;

// Use Pipeline
const result = Pipeline(
	"id,age,email,signupAt\n550e8400-e29b-41d4-a716-446655440000,30,alice@example.com,2023-01-15T10:30:00.000Z"
);

if (!(result instanceof type.errors)) {
	const _check: PipelineOutput = result;
	console.log("Type check passed");
	console.log("First signupAt:", result[0].signupAt);
	console.log("Is Date:", result[0].signupAt instanceof Date);
}
