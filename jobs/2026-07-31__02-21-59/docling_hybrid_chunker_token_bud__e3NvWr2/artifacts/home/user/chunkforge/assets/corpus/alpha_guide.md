# Alpha Operations Guide

The alpha platform is operated by a small on call rotation that hands over every week.

## Operations

### Deployment

#### Rollout Waves

##### Rollback Drill

Wave one covers the internal staging fleet only.

Wave two adds the two smallest production regions.

Wave three covers every remaining production region.

Each wave is gated by an automatic health probe.

The drill is repeated every quarter by the on call pair.

Findings from the drill are filed as follow up items.

### Capacity Notes

ZQXSENTINELALPHA marks the beginning of the capacity note that follows. The capacity planning window for the alpha fleet spans three consecutive quarters and is reviewed by the platform guild every month. Each region keeps a standing reservation of compute that is never handed back to the shared pool during a freeze period. Storage growth is projected from the trailing ninety day average and then padded by a fixed safety factor agreed with finance. When a projection exceeds the reservation the guild files a procurement ticket and records the expected delivery date in the ledger. Network egress is tracked separately because the billing model differs sharply between the internal backbone and the public transit links. A quarterly review compares the projection against the realised usage and the delta is folded back into the next projection round. Any region that misses its projection twice in a row is placed under a stricter weekly review until the drift disappears. The guild publishes the resulting numbers in a read only ledger so that every downstream team can plan against the same figures. The capacity planning window for the alpha fleet spans three consecutive quarters and is reviewed by the platform guild every month. Each region keeps a standing reservation of compute that is never handed back to the shared pool during a freeze period. Storage growth is projected from the trailing ninety day average and then padded by a fixed safety factor agreed with finance. When a projection exceeds the reservation the guild files a procurement ticket and records the expected delivery date in the ledger. Network egress is tracked separately because the billing model differs sharply between the internal backbone and the public transit links. A quarterly review compares the projection against the realised usage and the delta is folded back into the next projection round. Any region that misses its projection twice in a row is placed under a stricter weekly review until the drift disappears. The guild publishes the resulting numbers in a read only ledger so that every downstream team can plan against the same figures. ZQXSENTINELMIDDLE separates the historical review from the forward looking projection. The capacity planning window for the alpha fleet spans three consecutive quarters and is reviewed by the platform guild every month. Each region keeps a standing reservation of compute that is never handed back to the shared pool during a freeze period. Storage growth is projected from the trailing ninety day average and then padded by a fixed safety factor agreed with finance. When a projection exceeds the reservation the guild files a procurement ticket and records the expected delivery date in the ledger. Network egress is tracked separately because the billing model differs sharply between the internal backbone and the public transit links. A quarterly review compares the projection against the realised usage and the delta is folded back into the next projection round. Any region that misses its projection twice in a row is placed under a stricter weekly review until the drift disappears. The guild publishes the resulting numbers in a read only ledger so that every downstream team can plan against the same figures. The capacity planning window for the alpha fleet spans three consecutive quarters and is reviewed by the platform guild every month. Each region keeps a standing reservation of compute that is never handed back to the shared pool during a freeze period. Storage growth is projected from the trailing ninety day average and then padded by a fixed safety factor agreed with finance. When a projection exceeds the reservation the guild files a procurement ticket and records the expected delivery date in the ledger. Network egress is tracked separately because the billing model differs sharply between the internal backbone and the public transit links. A quarterly review compares the projection against the realised usage and the delta is folded back into the next projection round. Any region that misses its projection twice in a row is placed under a stricter weekly review until the drift disappears. The guild publishes the resulting numbers in a read only ledger so that every downstream team can plan against the same figures. ZQXSENTINELOMEGA closes the capacity note and no further text follows it.
