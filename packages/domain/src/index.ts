/**
 * @element-plus/domain
 *
 * Pure domain layer for Element Plus (عنصر پلاس).
 *
 * Owned boundaries: identity, workspace, problem, SPS, process, island, run,
 * package, authority, evidence, memory, knowledge, provenance, assets.
 *
 * Non-negotiable: this layer must remain free of Next.js, React, PostgreSQL
 * drivers, OpenClaw, and LLM/provider SDKs. This is enforced by the
 * architecture guard (`pnpm check:arch`) and by the architecture test in
 * `src/__tests__/architecture.test.ts`.
 *
 * Sprint 00: boundaries only — no product functionality yet.
 */
export {}
