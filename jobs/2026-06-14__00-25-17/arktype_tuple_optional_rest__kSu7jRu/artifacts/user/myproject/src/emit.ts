import { type } from "arktype";

const emit = type.fn(
	"string.alphanumeric >= 1 <= 50",
	"number.integer >= 0",
	[{ kind: "string", data: "unknown" }, "?"],
	"...",
	"string >= 1 <= 30"
)((name, timestamp, payload, ...tags) => {
	const event: {
		name: string;
		timestamp: number;
		payload?: { kind: string; data: unknown };
		tags: string[];
	} = { name, timestamp, tags };
	if (payload !== undefined) {
		event.payload = payload;
	}
	return { ok: true as const, event };
});

export { emit };