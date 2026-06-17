package cleanup

import (
	"encore.dev/cron"
)

var _ = cron.NewJob("cleanup-job", cron.JobConfig{
	Title:    "Cleanup Stale Records",
	Endpoint: CleanupStaleRecords,
	Every:    1 * cron.Hour,
})
