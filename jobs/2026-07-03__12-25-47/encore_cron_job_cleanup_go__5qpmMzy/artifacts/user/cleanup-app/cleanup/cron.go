package cleanup

import "encore.dev/cron"

//encore:cron
var _ = cron.NewJob("cleanup-cron", cron.JobConfig{
    Title:    "Cleanup stale records",
    Every:    1 * cron.Hour,
    Endpoint: Cleanup,
})
