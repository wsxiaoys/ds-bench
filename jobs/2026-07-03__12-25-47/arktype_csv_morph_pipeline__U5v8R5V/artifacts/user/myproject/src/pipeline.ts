import { type, ArkErrors } from 'arktype'

/**
 * Expected CSV header. The header must match this exactly (case-sensitive,
 * no extra columns, no leading/trailing whitespace).
 */
const EXPECTED_HEADER = 'id,age,email,signupAt' as const

/**
 * Raw record shape produced by the CSV parsing morph before validation.
 *
 * Each cell is a `string` at this stage; ArkType will morph the integer and
 * ISO date columns into their target types during the second stage of the
 * pipe.
 */
export type RawUserRecord = {
    id: string
    age: string
    email: string
    signupAt: string
}

/**
 * Per-cell validation schema for a single user record.
 *
 * - `id` must be a UUID.
 * - `age` is validated as a string-shaped integer and morphed into a real
 *   number in the inclusive range `[0, 150]`.
 * - `email` must be a valid email address.
 * - `signupAt` must be an ISO-8601 date string and is morphed into a `Date`.
 *
 * Every constraint lives in ArkType, not in handwritten TypeScript checks.
 */
const StringIntegerParse = type('string.integer.parse')
const AgeRange = type('0 <= number <= 150')

const UserT = type({
    id: 'string.uuid',
    age: type.pipe(StringIntegerParse, AgeRange),
    email: 'string.email',
    signupAt: 'string.date.iso.parse'
})

/**
 * Strongly-typed user record produced by the pipeline after validation.
 *
 * `age` is morphed from a string into an integer in the inclusive range
 * `[0, 150]` and `signupAt` is morphed from an ISO-8601 string into a real
 * `Date` instance, all via ArkType's morph/pipe machinery.
 */
export type UserRecord = typeof UserT.infer

/**
 * User-defined morph that splits a raw CSV string into an array of
 * record-shaped objects.
 *
 * This is the only place where raw CSV parsing logic lives; downstream
 * validation is entirely handled by ArkType via the pipe.
 *
 * Throws a descriptive `Error` if the input is empty, the header is
 * malformed, or any data row has the wrong number of comma-separated cells.
 * The error is caught and surfaced as `INVALID: <msg>` by the CLI.
 */
export const parseCsv = (csv: string): RawUserRecord[] => {
    if (csv.length === 0) {
        throw new Error('input is empty (no header row)')
    }

    const lines = csv.split('\n')

    if (lines[0] !== EXPECTED_HEADER) {
        throw new Error(
            `header row must be exactly ${JSON.stringify(EXPECTED_HEADER)} ` +
                `(got ${JSON.stringify(lines[0] ?? '')})`
        )
    }

    const records: RawUserRecord[] = []
    for (let i = 1; i < lines.length; i++) {
        // Skip trailing empty line that often appears when reading from stdin.
        if (lines[i].length === 0) continue

        const cells = lines[i].split(',')
        if (cells.length !== 4) {
            throw new Error(
                `row ${i + 1} has ${cells.length} columns, expected 4 ` +
                    `(got ${JSON.stringify(lines[i])})`
            )
        }

        records.push({
            id: cells[0],
            age: cells[1],
            email: cells[2],
            signupAt: cells[3]
        })
    }

    return records
}

/**
 * End-to-end ArkType pipeline.
 *
 * Composition (an explicit morph pipe, not a single inline schema):
 *
 *   1. `type('string')` — the raw CSV bytes from stdin.
 *   2. `parseCsv` — user-defined morph that produces an array of raw records.
 *   3. `UserT.array()` — validates each cell and morphs `age`/`signupAt`
 *      into their target types.
 *
 * On success, the inferred output is `UserRecord[]` where `signupAt` is a
 * real `Date`. On failure the result is an `ArkErrors` instance describing
 * the first constraint violation.
 */
export const PipelineT = type.pipe(type('string'), parseCsv, UserT.array())

/**
 * Run the pipeline on the given raw CSV string.
 *
 * Returns either the validated user records (on success) or a single
 * descriptive error message (on failure). This is the function the CLI
 * consumes; it isolates it from ArkType's internal error representation.
 */
export const runPipeline = (
    csv: string
): { ok: true; records: UserRecord[] } | { ok: false; error: string } => {
    const result = PipelineT(csv)

    if (result instanceof ArkErrors) {
        return { ok: false, error: result.summary }
    }

    return { ok: true, records: result as UserRecord[] }
}
