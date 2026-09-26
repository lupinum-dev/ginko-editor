# Active migrations

## Local Content 1.0.0-beta.10 candidate

- Why: the Editor needs Content fixes that are not published yet: MDC text escaping, verbatim code, parser-aligned heading ids (`createHeadingIdGenerator`), no bare-domain links, `isSafePublicLinkUrl`, and auto-close that skips fenced code.
- Introduced: 2026-09-25. Source: `ginko-content` branch `fix/mdc-roundtrip-contract` at `0000675`, packed with version `1.0.0-beta.10`.
- Archive: `internals/candidates/lupinum-ginko-content-1.0.0-beta.10.tgz`, SHA-256 `7185d72961d8a96c4ce290c4952a5a6cfe2eae6e5461bc99063d5ec605fa62a5`.
- Depends on it: the `@lupinum/ginko-content` override in `pnpm-workspace.yaml`, the default archive in `scripts/verify-packed-consumer.mjs` and `scripts/prepare-collaboration-fixture.mjs`, and the `>=1.0.0-beta.10` peer range.
- Removal condition: publish Content `1.0.0-beta.10` from that branch through the Content release workflow. Then remove the override, the archive, the script defaults, and this entry together, and run `pnpm release:verify`.
