import type { IslandManifest } from '@element-plus/contracts'

/**
 * Reference definitions for the Controlled Action Island.
 *
 * This island performs a real, externally effectful step: it writes a file
 * (`external_reversible`). Because the effect kind is external, the run engine
 * pauses for human approval before the tool executes — approval/rejection is
 * recorded on the run timeline and the effect history is inspectable.
 *
 * The `runtime.config.script` is the fake-runtime script: the engine parses it
 * and drives the same ToolGate handshake a real runtime would use.
 */

export const CONTROLLED_ACTION_CAPABILITY = {
  id: 'cap-controlled-action',
  name: 'Controlled Action',
  description: 'Perform an externally effectful action under human approval.',
  tags: ['action', 'effect'],
}

export const controlledActionIslandManifest: IslandManifest = {
  name: 'Controlled Action Island',
  description:
    'Reference island that performs a reversible external effect (write a file) under explicit human approval.',
  capabilities: [{ id: CONTROLLED_ACTION_CAPABILITY.id, kind: 'capability' }],
  runtime: {
    runtime: 'fake',
    config: {
      script: [
        {
          toolId: 'tool-write-file',
          arguments: {
            path: '/tmp/element-plus-controlled-action.txt',
            content: 'approved action',
          },
        },
      ],
    },
  },
  permissions: [],
}
