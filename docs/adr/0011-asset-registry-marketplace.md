# ADR 0011 — Asset Registry and Marketplace

- Status: accepted
- Sprint: 11
- Date: 2026-08-13

## Context

Sprint 11 makes reusable network capabilities distributable assets. No
payments/tokenomics.

## Decision

### Asset Registry

- Assets are versioned `(id, version)` with kind (island, process, skill,
  template, knowledge_package, evaluation_pack, dataset), name, description,
  tags, owner, visibility (private | workspace | public), license,
  `contentRef` (the underlying object), optional `rights`, and provenance.
- Prior versions are preserved; a new version is a new row.

### Publication gate

- `canPublishAsset` (pure, domain): public assets require a license; datasets
  require explicit rights metadata before public publication. Publication is
  owner-only and flips visibility private/workspace → public.

### Install, fork, derivative provenance

- Install is exact-version (strict semver) and idempotent per workspace;
  private assets can only be installed by their owner.
- Fork creates a new asset identity whose `provenance.derivedFrom` references
  the source asset (derivative provenance). Only public assets (or one's own)
  may be forked.

### Marketplace / My Assets

- Marketplace lists/searches public assets. My Assets lists owned + installed.
- Skill, Template, KnowledgePackage, EvaluationPack are supported as types
  through the same registry (contentRef points at the underlying object).

## Consequences

- Distributable assets are governed and traceable; dataset publication is
  gated on rights metadata as required by the specification.
- No payments/tokenomics were introduced.
