import { type } from "arktype";

const ResponseType = type({
	status: type.number.integer.and("100<=number<=599"),
	body: "string",
});

const fetchWithTimeout = type.fn(
	{
		url: "string.url",
		timeoutMs: type.number.integer.and("0<number<=10000"),
		retries: type.number.integer.and("0<=number<=5"),
	},
	":",
	Promise,
	async (params) => {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(ResponseType.assert({ status: 200, body: "ok" }));
			}, Math.min(params.timeoutMs, 50));
		});
	},
);

export { fetchWithTimeout };