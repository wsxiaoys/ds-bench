import { setup } from "@arktype/attest"

// Registers the @arktype/attest setup that pre-analyzes the project's
// type-level assertions (caches them in .attest/) before tests run.
// The returned function is used by Vitest as the global teardown.
export default function setupVitest() {
	return setup({})
}