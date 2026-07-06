import { type } from "arktype"

/**
 * A single raw row as parsed from the CSV, before any field-level
 * validation/morphing has been performed. Every cell is still a string.
 */
export type RawUserRow = {
	id: string
	age: string
	email: string
	signupAt: string
}

/**
 * The final, strongly-typed user record. `age` has been morphed from its
 * string cell into a real number and `signupAt` has been morphed from its
 * ISO-8601 string cell into a real `Date`.
 */
export type UserRecord = {
	id: string
	age: number
	email: string
	signupAt: Date
}

const EXPECTED_HEADER = "id,age,email,signupAt"

/**
 * `age` field: an explicit morph pipe.
 *
 *   string  --(string.integer.parse)-->  number  --(integer [0, 150])-->  number
 *
 * `string.integer.parse` validates that the cell is a well-formed integer
 * string and morphs it into a number; that number is then constrained by
 * ArkType to be an integer within the inclusive range [0, 150]. Both the
 * parsing and the range check are expressed as ArkType constraints/morphs —
 * no hand-written `if` checks are used.
 */
const AgeType = type("string.integer.parse").pipe(
	type("number.integer").atLeast(0).atMost(150)
)

/**
 * Per-record validation + morphing.
 *
 * Each field is validated entirely via ArkType keywords/operators:
 *   - `id`        must be a UUID string (`string.uuid`)
 *   - `age`       must be a well-formed integer string that parses to a
 *                 number in the inclusive range [0, 150] (see `AgeType`)
 *   - `email`     must be an email address (`string.email`)
 *   - `signupAt`  must be an ISO-8601 date string that is morphed into a
 *                 real `Date` (`string.date.iso.parse`)
 *
 * The `age` and `signupAt` fields are explicit morphs, so `UserRecordType`
 * is itself a morph: `(In: RawUserRow) => To<UserRecord>`.
 */
export const UserRecordType = type({
	id: "string.uuid",
	age: AgeType,
	email: "string.email",
	signupAt: "string.date.iso.parse"
})

/**
 * CSV parsing morph.
 *
 * Takes the *verbatim* raw CSV string (no trimming/normalization performed
 * before this point) and produces an array of raw, record-shaped objects
 * whose cells are still strings. All structural validation of the CSV
 * itself happens here, inside the ArkType pipeline:
 *
 *   - rejecting empty input (no header row at all)
 *   - rejecting a missing/reordered/altered/whitespace-padded header row
 *   - rejecting any data row that does not have exactly four comma-separated
 *     cells
 *
 * On any structural failure the morph registers an error via `ctx.reject`
 * and short-circuits by returning an empty array; the queued errors cause
 * the overall pipeline result to be an `ArkErrors` instance.
 */
const parseCsv = type.string.pipe((raw: string, ctx): RawUserRow[] => {
	if (raw.length === 0) {
		ctx.reject({
			code: "predicate",
			expected:
				'a non-empty CSV whose first line is exactly the header row "id,age,email,signupAt"',
			actual: "an empty string"
		})
		return []
	}

	// Split on either \n or \r\n. The header comparison below is exact, so a
	// stray trailing carriage return on the header line would correctly be
	// rejected as a malformed header.
	const lines = raw.split(/\r?\n/)

	// A single trailing empty line (caused by a final newline) is benign and
	// is dropped. Any *additional* trailing blank lines remain and will be
	// rejected by the column-count check below.
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop()
	}

	if (lines.length === 0) {
		ctx.reject({
			code: "predicate",
			expected:
				'a non-empty CSV whose first line is exactly the header row "id,age,email,signupAt"',
			actual: "an empty string"
		})
		return []
	}

	const header = lines[0]!
	if (header !== EXPECTED_HEADER) {
		ctx.reject({
			code: "predicate",
			expected: `a header row exactly equal to "${EXPECTED_HEADER}"`,
			actual: JSON.stringify(header)
		})
		return []
	}

	const rows: RawUserRow[] = []
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]!
		const cells = line.split(",")
		if (cells.length !== 4) {
			ctx.reject({
				code: "predicate",
				expected: "exactly 4 comma-separated cells",
				actual: `row ${i} has ${cells.length} cell(s): ${JSON.stringify(line)}`
			})
			// Short-circuit: no point continuing once the structure is broken.
			return []
		}
		rows.push({
			id: cells[0]!,
			age: cells[1]!,
			email: cells[2]!,
			signupAt: cells[3]!
		})
	}

	return rows
})

/**
 * The end-to-end pipeline.
 *
 *   string  --(parseCsv morph)-->  RawUserRow[]
 *          --(UserRecordType[])-->  UserRecord[]
 *
 * The composition is done with ArkType's pipe operator: the CSV-parsing
 * morph feeds its output into an array of per-record morph validation, so
 * the entire transformation from raw bytes to typed records is a single
 * ArkType pipeline.
 */
export const CsvPipeline = parseCsv.pipe(UserRecordType.array())