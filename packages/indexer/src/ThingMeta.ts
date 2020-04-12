import { GunGraphAdapter, GunNode, unpackNode } from '@chaingun/sea-client'
import { Listing, Schema, Thing, ThingDataNode } from '@notabug/peer'
import { LRUMap } from 'lru_map'
import { mergeDeepLeft } from 'ramda'
import { THING_META_CACHE_SIZE } from './config'
import { pathsForThing } from './paths-for-thing'
import { calculateSortScores } from './sorts'
import {
  ListingUpdate,
  TabulatorThingChanges,
  ThingID,
  ThingMetaRecord,
  ThingScores
} from './types'

const { ListingNode } = Listing

export class ThingMeta {
  protected readonly adapter: GunGraphAdapter
  protected readonly cache: LRUMap<string, Promise<ThingMetaRecord>>
  protected readonly pub: string

  constructor(adapter: GunGraphAdapter, pub: string) {
    this.pub = pub
    this.adapter = adapter
    this.cache = new LRUMap(THING_META_CACHE_SIZE)
  }

  public async getPaths(thingId: string): Promise<readonly string[]> {
    const record = await this.fetch(thingId)
    return pathsForThing(record)
  }

  public async update(
    thingId: ThingID,
    changes: TabulatorThingChanges,
    timestamp?: number
  ): Promise<{
    counts: Partial<ThingScores>
    listingUpdates: ListingUpdate[]
  }> {
    const now = timestamp || new Date().getTime()
    const record = await this.fetch(thingId)

    if (!record.created) {
      record.created = changes.created || new Date().getTime()
    }

    if (changes.updated > record.updated || !record.updated) {
      record.updated = changes.updated || new Date().getTime()
    }

    const counts: Partial<ThingScores> = {}

    if (changes.commands) {
      counts.commands = record.counts.commands = mergeDeepLeft(
        changes.commands,
        record.scores.commands || {}
      )
    }

    for (const key of ['up', 'down', 'comment', 'replies', 'score']) {
      if (changes[key]) {
        counts[key] = record.counts[key] =
          (record.counts[key] || 0) + (changes[key] || 0)
      }
    }

    // const currentScores = record.scores
    const scores = (record.scores = calculateSortScores(record))

    const listingUpdates: ListingUpdate[] = []

    for (const sortName in scores) {
      if (!sortName) {
        continue
      }

      const sortValue = scores[sortName]

      /*
      // This optimization seems a bit buggy at the moment
      if (!changes.created && sortValue === currentScores[sortName]) {
        continue
      }
      */

      pathsForThing(record).forEach(path =>
        listingUpdates.push([
          ListingNode.soulFromPath(this.pub, `${path}/${sortName}`),
          thingId,
          sortValue,
          now
        ])
      )
    }

    record.scores = scores

    return {
      counts,
      listingUpdates
    }
  }

  protected fetch(thingId: ThingID): Promise<ThingMetaRecord> {
    const existing = this.cache.get(thingId)

    if (existing) {
      return Promise.resolve(existing)
    }

    const promise = new Promise<ThingMetaRecord>(async (resolve, reject) => {
      try {
        const countsSoul = Schema.ThingVoteCounts.route.reverse({
          tabulator: this.pub,
          thingId
        })

        const thingSoul = Schema.Thing.route.reverse({
          thingId
        })

        if (!countsSoul || !thingSoul) {
          throw new Error(
            `Unable to generate counts or thing soul for: ${thingId}`
          )
        }

        const [countsNode, thingNode] = await Promise.all([
          this.adapter.get(countsSoul).then(unpackNode),
          this.adapter.get(thingSoul)
        ])
        const replyToSoul = thingNode?.replyTo?.['#']
        const thingDataSoul = thingNode?.data?.['#']

        const [replyToNode, thingData] = await Promise.all([
          replyToSoul ? this.adapter.get(replyToSoul) : Promise.resolve(null),
          thingDataSoul
            ? this.adapter.get(thingDataSoul).then(unpackNode)
            : Promise.resolve(null)
        ])

        resolve(
          nodesToMetaRecord(
            thingNode,
            thingData,
            countsNode,
            replyToNode || undefined
          )
        )
      } catch (e) {
        reject(e)
      }
    })

    this.cache.set(thingId, promise)
    return promise
  }
}

function nodesToMetaRecord(
  thingNode: GunNode,
  thingData: GunNode,
  countsNode?: GunNode,
  replyToNode?: GunNode
): ThingMetaRecord {
  const { timestamp: created = new Date().getTime } = thingNode

  return {
    isCommand: ThingDataNode.isCommand(thingData),
    authorId: Thing.authorId(thingNode) || ThingDataNode.authorId(thingData),
    opId: Thing.opId(thingNode) || ThingDataNode.opId(thingData),
    replyToId:
      ThingDataNode.replyToId(thingData) || ThingDataNode.replyToId(thingData),
    replyToAuthorId: Thing.authorId(replyToNode),
    replyToKind: Thing.kind(replyToNode),
    kind: Thing.kind(thingNode) || ThingDataNode.kind(thingData),
    topic: (
      Thing.topic(thingNode) ||
      ThingDataNode.topic(thingData) ||
      'whatever'
    ).toLowerCase(),
    domain: (ThingDataNode.domain(thingData) || 'unknown').toLowerCase(),
    created,
    updated: countsNode?._?.['>']?.comment || created,
    counts: {
      up: parseInt(countsNode?.up, 10) || 0,
      down: parseInt(countsNode?.down, 10) || 0,
      score: parseInt(countsNode?.score, 10) || 0,
      comment: parseInt(countsNode?.comment, 10) || 0,
      replies: parseInt(countsNode?.replies, 10) || 0,
      commands: countsNode?.commands || {}
    },
    scores: {}
  }
}
