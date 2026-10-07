---
"@lupinum/ginko-editor": minor
---

Change new component command insertions to record angle syntax and explicit colon input to record colon syntax. Preserve the colon default for older persisted rooms without source-origin metadata when paired with Content's new angle default.

Migration: update client and backend together. Existing room JSON and history stay intact. After old writers retire, hosts can reseed from accepted canonical Markdown in a new epoch, preserve pending recovery, and then retire the tracked legacy fallback.
