import Route from "route-parser"

export type Timestamp = number

export interface SchemaNodeType {
  soul: {
    patttern: string
  }
  route: Route
}

export interface SchemaNodeTypeMap {
  [name: string]: SchemaNodeType
}

export interface GunEdge {
  "#": string
}

export interface ThingDataNodeType {
  title: string
  topic: string
  url?: string
  body?: string
  author?: string
  authorId?: string
  opId?: string
  replyToId?: string
  domain?: string
  timestamp: number | string
}

export interface ThingNode {
  id: string
  timestamp: number | string
  kind: string
  originalHash: string
  data: GunEdge
  votesup: GunEdge
  votesdown: GunEdge
  comments: GunEdge
  allcomments: GunEdge
  topic?: GunEdge
  author?: GunEdge
  op?: GunEdge
  replyTo?: GunEdge
}

export interface ThingDataMap {
  [id: string]: ThingDataNodeType
}

export interface CommandMapNode {
  [key: string]: CommandMapNode | Timestamp
}

export interface CommandMap {
  [authorId: string]: CommandMapNode
}

export type GunNodeType = any

export type NabProtocolMsg = any

export type GunChainCb = (this: GunChain, node: GunNodeType) => void
export type GunPromiseCb = (node: GunNodeType) => any

export interface GunChain {
  off: () => void
  on: (cb: GunChainCb) => void
  once: (cb: GunChainCb) => void
  not: (cb: GunChainCb) => GunChain
  get: (soul: string) => GunChain
  then: (cb?: GunPromiseCb) => Promise<GunNodeType>
}

export interface GunScope extends GunChain {
  getCache: () => any
}

export type SortDataRow = [string, number]
export type ListingNodeRow = [number | null, string | null, number | null]

export type ListingNodeType = any

export type ListingDefinitionType = any

export interface ListingSpecType extends ListingDefinitionType {}

export interface ThingVoteCountsType {
  up: number
  down: number
  comment: number
  replies: number
  score: number
  commands?: string | any
}

export interface CombinedThingType {
  id: string
  opId?: string
  replyToId?: string
  data?: any
  votes?: any
  timestamp: number
  lastActive?: number
}
