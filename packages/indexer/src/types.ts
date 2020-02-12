import { GunGraphData } from '@chaingun/sea-client'

export type RankourListingSoul = string
export type RankourListingKey = string
export type RankourThingId = string
export type RankourSortValue = number
export type RankourListingItem = [
  RankourListingSoul,
  RankourListingKey,
  RankourThingId,
  RankourSortValue
]

export type ListingUpdate = [
  RankourListingSoul,
  RankourThingId,
  RankourSortValue,
  number
]

export interface CommandMapNode {
  [key: string]: CommandMapNode | number
}

export interface CommandMap {
  [authorId: string]: CommandMapNode
}

export interface ThingScores {
  up: number
  down: number
  score: number
  comment: number
  replies: number
  commandMap: CommandMap
}

export type ThingID = string

export type ScoreCache = Record<ThingID, ThingScores | false>

export interface TabulatorThingChanges {
  up?: number
  down?: number
  score?: number
  comment?: number
  replies?: number
  commandMap?: CommandMap
  created?: number
  updated?: number
}

export interface TabulatorChanges {
  [thingId: string]: TabulatorThingChanges
}

export type ThingMetaSortScores = Record<string, number | undefined>

export interface ThingMetaRecord {
  created: number
  updated: number
  kind: string
  authorId?: string
  isCommand: boolean
  topic: string
  domain: string | null
  replyToId: string | null
  replyToKind: string | null
  replyToAuthorId: string | null
  opId: string | null
  counts: ThingScores
  scores: ThingMetaSortScores
}

export type GraphSigner = (graph: GunGraphData) => Promise<GunGraphData>
