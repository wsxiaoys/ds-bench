import { type, type ArkErrors } from "arktype";

/**
 * Parameter signature for `emit`, expressed as a single tuple:
 *
 *     [eventName, timestamp, payload?, ...tags]
 *
 *   - `eventName`  : an alphanumeric string with length between 1 and 50 (inclusive).
 *   - `timestamp`   : a non-negative integer.
 *   - `payload`     : (optional) an object `{ kind: string, data: unknown }`.
 *   - `tags`        : a variadic rest of strings, each with length between 1 and 30 (inclusive).
 *
 * `type.fn` consumes this tuple as the *parameter list* of the returned function,
 * so every argument is validated positionally against the tuple element it maps to.
 */
export const emit = type.fn(
	"string.alphanumeric>=1<=50",
	"number.integer>=0",
	[{ kind: "string", data: "unknown" }, "?"],
	["...", "(string>=1<=30)[]"],
)(
	(name, timestamp, payload, ...tags) => {
		const event: {
			name: string;
			timestamp: number;
			tags: string[];
			payload?: { kind: string; data: unknown };
		} = {
			name,
			timestamp,
			tags,
		};

		// Only attach `payload` when one was actually provided, so the property
		// is omitted entirely (not set to `undefined`) from the resulting event.
		if (payload !== undefined) {
			event.payload = payload;
		}

		return { ok: true, event };
	},
);

export type EmitResult = ReturnType<typeof emit>;

/** Re-exported so the CLI can distinguish a validation rejection from other errors. */
export { type ArkErrors };