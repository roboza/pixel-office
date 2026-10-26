/** Which loop sits at a desk: a subagent, a workflow script's agent or a teammate. */
export type OfficeAgentKind = 'sub' | 'workflow' | 'teammate'

export type OfficeAgent = {
  /** The agent's id, as `agent.spawn` answers it and its loop's events carry it. */
  id: string
  kind: OfficeAgentKind
  /** The agent type it was spawned as (`Explore`, `general-purpose`, ...). */
  type: string
  /** The name on its plate, `Ellie` or `Ellie 2`. */
  name: string
  /** The role on its plate, `Explorer`. */
  role: string
  desk: number
  description: string
  prompt: string
  status: 'working' | 'waiting' | 'done'
  outcome?: 'ok' | 'failed'
  spawnedAt: number
  endedAt?: number
  /** The tool it is running now, if any. */
  tool?: string
  toolCount: number
  /** Files it read (IN tray) and wrote (OUT tray), newest last. */
  filesIn: string[]
  filesOut: string[]
  /** Seeds its hair, skin and hair style. */
  look: number
  shirt: string
  background: boolean
}

export type OfficeMain = {
  tool?: string
  waiting: boolean
  toolCount: number
  filesIn: string[]
  filesOut: string[]
  since: number
}

/** Another Claude Code session running this mod, read from its heartbeat. */
export type OfficePeer = {
  id: string
  label: string
  agents: number
  isActive: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-office': {
      agents: OfficeAgent[]
      main: OfficeMain
      peers: OfficePeer[]
      /** The id of the desk whose details show; `main` for the manager, '' for none. */
      selected: string
    }
  }
}
