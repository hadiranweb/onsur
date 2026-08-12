import type { ToolContract } from '@element-plus/contracts'
import type { ToolRegistry } from '../ports'

const STATIC_PROVENANCE = {
  createdAt: '2026-08-13T00:00:00.000Z',
  derivedFrom: [],
  reason: 'default tool contract (seed)',
  source: 'system' as const,
}

/**
 * Default tool contracts for Sprint 05. `tool-send-email` is the canonical
 * irreversible effect used by the approval scenario; `tool-analyze` is the
 * read-only tool the Structured Analysis island uses.
 */
export const DEFAULT_TOOL_CONTRACTS: ToolContract[] = [
  {
    id: 'tool-analyze',
    name: 'Analyze',
    description: 'Read-only analysis of a problem specification.',
    inputSchema: { input: 'string' },
    effectKind: 'read_only',
    requiresApproval: false,
    provenance: STATIC_PROVENANCE,
  },
  {
    id: 'tool-send-email',
    name: 'Send Email',
    description: 'Send an email — an irreversible external effect.',
    inputSchema: { to: 'string', subject: 'string', body: 'string' },
    effectKind: 'external_irreversible',
    requiresApproval: true,
    provenance: STATIC_PROVENANCE,
  },
  {
    id: 'tool-write-file',
    name: 'Write File',
    description: 'Write a file — a reversible external effect.',
    inputSchema: { path: 'string', content: 'string' },
    effectKind: 'external_reversible',
    requiresApproval: true,
    provenance: STATIC_PROVENANCE,
  },
]

export class InMemoryToolRegistry implements ToolRegistry {
  constructor(private readonly contracts: ToolContract[] = DEFAULT_TOOL_CONTRACTS) {}

  get(id: string): ToolContract | null {
    return this.contracts.find((contract) => contract.id === id) ?? null
  }

  list(): ToolContract[] {
    return [...this.contracts]
  }
}
