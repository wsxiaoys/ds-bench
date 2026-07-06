import { setup } from "@arktype/attest"

// Wire ArkType's `attest` type snapshots and assertion cache into the test
// process. This must be invoked before any test loads so the type-level
// metadata captured from `attest(...)` calls is available at test time.
export default () => setup({ updateSnapshots: true })
