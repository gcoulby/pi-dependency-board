export type TeamId = string
export type SprintId = string
export type CardTypeId = string
export type CardId = string
export type DependencyId = string
export type AssetId = string

export const EXTERNAL_LANE_ID = 'external' as const
export type LaneId = TeamId | typeof EXTERNAL_LANE_ID

export interface Team {
  id: TeamId
  name: string
  colour: string // #rrggbb
}

export type SprintSlot = 'start' | 'end'

export interface Sprint {
  id: SprintId
  name: string
  start?: string // ISO date
  end?: string
  isInnovation?: boolean
}

export type CardTypeIcon =
  | 'Layers'
  | 'Wrench'
  | 'FlaskConical'
  | 'Hammer'
  | 'ShieldAlert'
  | 'Flag'
  | 'Rocket'
  | 'Bug'
  | 'Zap'
  | 'Package'
  | 'Target'
  | 'Users'
  | 'Cloud'
  | 'Database'
  | 'Puzzle'
  | 'Star'

export interface CardType {
  id: CardTypeId
  name: string
  colour: string // #rrggbb, validated on input
  icon: CardTypeIcon // a string key, never a component reference
}

export interface BoardConfig {
  pi: { name: string; startDate?: string }
  teams: Team[]
  sprints: Sprint[]
  cardTypes: CardType[]
  externalLane: { label: string }
}

export interface CardAttachment {
  id: AssetId
  filename: string
  size: number
  mimeType: string
}

export interface Card {
  id: CardId
  title: string
  typeId: CardTypeId
  laneId: LaneId
  sprintId: SprintId
  order: number // index within its cell
  slot?: SprintSlot // first or second half of the sprint. Defaults to 'start'
  description?: string
  owner?: TeamId // the team that owns the card, by team id
  estimate?: number
  party?: string // external cards only
  tags: string[]
  properties: Record<string, string>
  attachments?: CardAttachment[]
  hasContent: boolean
  createdAt: string
  updatedAt: string
}

export type DependencyState = 'proposed' | 'agreed' | 'at-risk'

export interface Dependency {
  id: DependencyId
  from: CardId // must be delivered first
  to: CardId // needs `from`
  label?: string
  notes?: string
  state: DependencyState
  createdAt: string
}

export type ScheduleCheck = 'ok' | 'same-sprint' | 'conflict'

export interface BoardManifest {
  format: 'piboard'
  version: number
  title: string
  created: string
  modified: string
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
