import type { IslandManifest } from '@element-plus/contracts'

/**
 * Reference definitions for the first Element Plus Island: Structured Analysis.
 *
 * This is a seed manifest, not a runtime implementation. It declares the
 * capability it provides and the runtime it will bind to (the fake runtime
 * adapter arrives in Sprint 05; OpenClaw in Sprint 06).
 */

export const STRUCTURED_ANALYSIS_CAPABILITY = {
  id: 'cap-structured-analysis',
  name: 'Structured Analysis',
  description: 'Analyze a problem into evidence, assumptions, unknowns, and success criteria.',
  tags: ['analysis', 'founder'],
}

export const structuredAnalysisIslandManifest: IslandManifest = {
  name: 'Structured Analysis Island',
  description:
    'Reference island that runs the structured analysis process over a confirmed ProblemSpecification.',
  capabilities: [{ id: STRUCTURED_ANALYSIS_CAPABILITY.id, kind: 'capability' }],
  runtime: { runtime: 'fake', config: {} },
  permissions: [],
}
