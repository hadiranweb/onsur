# ADR 0004 — Capability, Process, and Island registries

- Status: accepted
- Sprint: 04
- Date: 2026-08-13

## Context

Sprint 04 resolves a confirmed ProblemSpecification into reusable, executable
structure: Capabilities, Processes, and Islands, with reuse-before-creation and
strict lifecycle rules.

## Decision

### Registries are global, versioned, immutable-when-published

- Capabilities, Processes, and Islands are stored in versioned registries keyed
  by `(id, version)`. A new version is a new row; the prior version is never
  mutated in place.
- "Latest" is defined by semver (via `maxVersion`), not insert time, matching
  the determinism decision in ADR 0003.
- Lifecycle transitions (Process: draft→validated→published→superseded;
  Island: draft→candidate→active→retired) are explicit events, not content
  mutation. Published/active content is frozen; changes are new versions.

### Reuse before creation (pure)

`resolveIsland(candidates, requiredCapabilityIds)` in the domain layer returns
the best compatible active Island (one that provides every required capability,
scoring by overlap). The application `IslandService.resolveOrCreate` reuses it
or creates a draft Island on no match. The decision core is pure and tested.

### Island manifests

`islandManifestSchema` captures the reusable declaration (name, description,
capabilities, runtime binding, permissions); `islandSchema` = manifest +
identity (id, version) + status + provenance.

### Reference island

`structuredAnalysisIslandManifest` is a seed manifest (capability
"Structured Analysis", runtime binding `fake`). `ensureReferenceIsland`
registers the capability if absent, then reuses an existing compatible active
island or creates/activates a new one. The `fake` runtime binding is declared
intent only; the fake runtime adapter arrives in Sprint 05 and OpenClaw in
Sprint 06.

## Consequences

- The registry is shared (network-level reuse), which is why Islands/Processes
  are not workspace-scoped; publication/visibility governance (who may publish
  and consume) arrives with the Asset Registry in Sprint 11.
- Provenance `derivedFrom` links registry objects back to the
  ProblemSpecification that motivated them.
