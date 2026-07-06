import { type } from "arktype";

// ---------------------------------------------------------------------------
// Record shape
// ---------------------------------------------------------------------------
//
// A user record is validated and morphed by ArkType:
//   * `id`       must be a UUID string
//   * `age`      must be an integer in the inclusive range [0, 150]
//   * `email`    must be an email address
//   * `signupAt` must be an ISO-8601 date string that is morphed into a
//                 real `Date` instance via `string.date.iso.parse`
//
// `string.date.iso.parse` is the built-in ArkType morph that reaches `Date`
// for the ISO date column. No `new Date(...)` is hand-rolled anywhere in
// this file; the conversion is the entire point of the morph pipe.
// `string.integer.parse` validates the cell is a well-formed integer
// string and morphs it into a real `number`. The `.to(...)` step pipes
// the parsed number through the inclusive range check, so the final
// output of the `age` field is a real `number` in [0, 150].
const AgeField = type("string.integer.parse").to("0 <= number.integer <= 150");

export const UserRecord = type({
	id: "string.uuid",
	age: AgeField,
	email: "string.email",
	signupAt: "string.date.iso.parse"
});

export const UserRecordArray = UserRecord.array();

// Raw row shape produced by the CSV parsing morph. Each cell is left as a
// string here so that the validation step (UserRecordArray) is the single
// place where the per-cell constraints are enforced.
type RawRow = {
	id: string;
	age: string;
	email: string;
	signupAt: string;
};

const EXPECTED_HEADER = "id,age,email,signupAt";
const EXPECTED_COLUMN_COUNT = 4;

/**
 * Custom morph: take the raw CSV string verbatim, validate the header, and
 * return an array of raw record-shaped objects. Per-cell constraints are
 * *not* checked here; they are the responsibility of the downstream
 * `UserRecordArray` validation step in the pipe.
 *
 * Throws a descriptive `Error` when:
 *   * the input is empty (no header row at all)
 *   * the header row is missing, reordered, or otherwise altered
 *   * any data row does not have exactly four comma-separated cells
 *
 * The bytes are not trimmed or normalized: the input is split on `\n` only.
 */
function parseCsv(raw: string): RawRow[] {
	if (raw === "") {
		throw new Error("input is empty (no header row present)");
	}

	const lines = raw.split("\n");
	const header = lines[0];
	if (header !== EXPECTED_HEADER) {
		throw new Error(
			`header row is malformed: expected exactly ${JSON.stringify(
				EXPECTED_HEADER
			)} (case-sensitive, no whitespace), got ${JSON.stringify(header)}`
		);
	}

	const records: RawRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const row = lines[i];
		const cells = row.split(",");
		if (cells.length !== EXPECTED_COLUMN_COUNT) {
			throw new Error(
				`row ${i + 1} has ${cells.length} column(s), expected exactly ${EXPECTED_COLUMN_COUNT}`
			);
		}
		records.push({
			id: cells[0],
			age: cells[1],
			email: cells[2],
			signupAt: cells[3]
		});
	}

	return records;
}

// ---------------------------------------------------------------------------
// End-to-end pipeline
// ---------------------------------------------------------------------------
//
// `type.pipe(...)` composes the three stages into a single `Type`:
//
//   1. `"string"`              — accepts a raw CSV string
//   2. `parseCsv`              — morphs the string into an array of raw rows
//                                (throws on structural problems)
//   3. `UserRecordArray`       — validates every row's cells and morphs the
//                                ISO date string into a real `Date` instance
//
// Any `Type` is itself root-invocable, so passing `UserRecordArray` to
// `type.pipe` is what lets the second step's array output be validated by
// the third step.
export const Pipeline = type.pipe(type.string, parseCsv, UserRecordArray);

// Strongly-typed output of the pipeline. The `signupAt` field is a real
// `Date` instance thanks to the `string.date.iso.parse` morph.
export type PipelineOutput = typeof Pipeline.inferOut;
