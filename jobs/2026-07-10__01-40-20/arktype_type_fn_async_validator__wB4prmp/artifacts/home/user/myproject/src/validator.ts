import { type } from "arktype";

/**
 * ArkType `Type` describing the resolved response shape.
 *
 * This `Type` is applied to the *resolved* value of the `Promise` returned by
 * `fetchWithTimeout`, so the runtime resolution is guaranteed to satisfy the
 * declared contract (in addition to the `type.fn` return-shape check).
 */
export const Response = type({
	status: "number.integer >= 100 <= 599",
	body: "string"
});

/**
 * ArkType `Type` describing the single parameter accepted by `fetchWithTimeout`.
 */
const Params = type({
	url: "string.url",
	timeoutMs: "number.integer > 0 <= 10000",
	retries: "number.integer >= 0 <= 5"
});

/**
 * The `(Promise)` return shape enforced at the `type.fn` boundary.
 *
 * `type.fn` validates the value returned by the implementation *synchronously*
 * via `returns.assert(returned)`. For an async implementation this guarantees
 * the returned value is a real `Promise` instance before it is ever awaited.
 */
const PromiseReturn = type.instanceOf(Promise);

/**
 * A runtime-validated asynchronous fetch wrapper built with ArkType's
 * `type.fn`.
 *
 * Parameter validation is performed *synchronously* at the `type.fn`
 * boundary (`params.assert(args)`) BEFORE the implementation is invoked, so
 * any invalid parameter throws before a `setTimeout` is ever scheduled.
 *
 * The implementation simulates a network call with `setTimeout` and always
 * resolves with `{ status: 200, body: "ok" }` after `min(timeoutMs, 50)` ms.
 * The resolved value is then validated against the `Response` `Type` so the
 * runtime resolution is guaranteed to satisfy the declared contract.
 */
export const fetchWithTimeout = type.fn(
	Params,
	":",
	PromiseReturn
)(
	async (params) => {
		const delay = Math.min(params.timeoutMs, 50);

		const result = await new Promise<{ status: number; body: string }>(
			(resolve) => {
				setTimeout(
					() => resolve({ status: 200, body: "ok" }),
					delay
				);
			}
		);

		// Validate the resolved value against the declared response contract.
		// A failure here rejects the returned Promise (caught by callers).
		return Response.assert(result);
	}
);