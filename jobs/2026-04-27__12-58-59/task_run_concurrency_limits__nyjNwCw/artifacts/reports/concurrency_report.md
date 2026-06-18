# Prefect Concurrency Limit Report

The following concurrency limit was set:
- Tag: heavy-processing
- Limit: 2

Verification:
```
                               Concurrency Limits                               
┏━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━┓
┃ Tag          ┃                              ID ┃ Concurrency … ┃ Active Tas… ┃
┡━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━┩
│ heavy-proce… │ 842403da-12e2-45e1-8870-986549… │ 2             │ 0           │
└──────────────┴─────────────────────────────────┴───────────────┴─────────────┘
```

The `process_data` task in `/home/user/project/flow.py` was updated to include the `heavy-processing` tag.
