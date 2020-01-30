// tslint:disable: readonly-keyword no-object-mutation no-let
import { GunGraphData, GunProcessQueue } from '@chaingun/sea-client'
import { Config, Listing, Query, Schema, ThingDataNode } from '@notabug/peer'
import { NotabugClient } from './client'
import { NotabugWorker } from './worker'

const WRITE_TIMEOUT = 60000
const { ListingSort, ListingNode, ListingSpec } = Listing

export class NabIndexer extends NotabugClient {
  public readonly indexerQueue: GunProcessQueue<string>
  protected lastSeenKey: string

  constructor(worker: NotabugWorker) {
    super(worker)
    this.indexerQueue = new GunProcessQueue()
    this.indexerQueue.middleware.use(id => indexThing(this, id))

    this.indexerQueue.emptied.on(() => {
      if (this.lastSeenKey) {
        this.worker.internalAdapter.put({
          oracles: {
            _: {
              '#': 'oracles',
              '>': {
                indexer: new Date().getTime()
              }
            },
            indexer: this.lastSeenKey
          }
        })
      }
    })
  }

  public start(): Promise<void> {
    return this.authenticate(
      process.env.NAB_INDEXER_ALIAS,
      process.env.NAB_INDEXER_PASSWORD
    )
      .then(async ({ pub }) => {
        Config.update({
          indexer: pub,
          tabulator: process.env.NAB_TABULATOR || pub
        })

        const oracles = await this.readNode('oracles')
        const from = (oracles && oracles.indexer) || ''

        this.worker.changelogFeed.feed((key: string, diff: GunGraphData) => {
          this.indexerQueue.enqueueMany(idsToIndex(diff))
          this.indexerQueue.process()
          this.sawKey(key)
        }, from)

        // tslint:disable-next-line: no-console
        console.log('---Started indexer---')
      })
      .catch(e => {
        // tslint:disable-next-line: no-console
        console.warn('Unable to authenticate indexer', e)
      })
  }

  public sawKey(key: string): void {
    this.lastSeenKey = key
  }
}

export async function getListings(
  scope: any,
  thingId: string
): Promise<readonly string[]> {
  if (!thingId) {
    return []
  }
  // tslint:disable-next-line: readonly-array
  const listings: string[] = []

  const [data, scores] = await Promise.all([
    Query.thingData(scope, thingId),
    Query.thingScores(scope, thingId)
  ])

  if (!data) {
    return []
  }

  const kind = ThingDataNode.kind(data)
  const authorId = ThingDataNode.authorId(data)
  const topic = ThingDataNode.topic(data)
    .trim()
    .toLowerCase()

  if (kind === 'submission') {
    const domain = ThingDataNode.domain(data)
    const commands = (scores && scores.commands) || {}
    // tslint:disable-next-line: readonly-array
    const taggedBy: any[] = []

    for (const key in commands) {
      if (key !== 'anon') {
        taggedBy.push(key)
      }
    }

    if (topic) {
      listings.push(`/t/${topic}`)
    }

    if (topic !== 'all') {
      const dotIdx = topic.indexOf('.')

      if (dotIdx === -1 || dotIdx === 0) {
        listings.push('/t/all')
      } else {
        const source = topic.slice(0, dotIdx)

        if (source !== 'test') {
          listings.push('/t/external.all')
        }

        listings.push(`/t/${source}.all`)
      }
    }

    if (domain) {
      listings.push(`/domain/${domain}`)
    }

    if (authorId) {
      listings.push(`/user/${authorId}/submitted`)
      listings.push(`/user/${authorId}/overview`)
    }

    taggedBy.forEach(tagAuthorId =>
      listings.push(`/user/${tagAuthorId}/commented`)
    )
  } else if (kind === 'comment') {
    const opId = ThingDataNode.opId(data)
    const replyToId = ThingDataNode.replyToId(data)
    const isCommand = ThingDataNode.isCommand(data)

    if (opId) {
      listings.push(`/things/${opId}/comments`)
    }
    if (topic) {
      listings.push(`/t/comments:${topic}`)
    }

    if (topic !== 'all') {
      const dotIdx = topic.indexOf('.')

      if (dotIdx === -1 || dotIdx === 0) {
        listings.push('/t/comments:all')
      } else {
        const source = topic.slice(0, dotIdx)

        if (source !== 'test') {
          listings.push('/t/comments:external.all')
        }

        listings.push(`/t/comments:${source}.all`)
      }
    }

    if (replyToId) {
      const replyToThingData = await Query.thingData(scope, replyToId)
      const replyToAuthorId = ThingDataNode.authorId(replyToThingData)

      if (replyToAuthorId) {
        const replyToKind = ThingDataNode.kind(replyToThingData)
        listings.push(`/user/${replyToAuthorId}/replies/overview`)
        if (replyToKind === 'submission') {
          listings.push(`/user/${replyToAuthorId}/replies/submitted`)
        } else if (replyToKind === 'comment') {
          listings.push(`/user/${replyToAuthorId}/replies/comments`)
        }
      }
    }

    if (authorId) {
      listings.push(`/user/${authorId}/comments`)
      listings.push(`/user/${authorId}/overview`)
      if (isCommand) {
        listings.push(`/user/${authorId}/commands`)
      }
      // TODO: update commented
    }
  } else if (kind === 'chatmsg') {
    if (topic) {
      listings.push(`/t/chat:${topic}`)
    }
    if (topic !== 'all') {
      const dotIdx = topic.indexOf('.')

      if (dotIdx === -1 || dotIdx === 0) {
        listings.push('/t/chat:all')
      } else {
        const source = topic.slice(0, dotIdx)

        if (source !== 'test') {
          listings.push('/t/chat:external.all')
        }
        listings.push(`/t/chat:${source}.all`)
      }
    }
  }

  return listings
}

export async function describeThingId(
  scope: any,
  thingId: string
): Promise<{
  readonly id: string
  readonly includes: readonly string[]
  readonly sorts: ReadonlyArray<readonly any[]>
}> {
  if (!thingId) {
    return null
  }
  const spec = ListingSpec.fromSource('')
  const includes: readonly string[] = await getListings(scope, thingId)
  if (!includes.length) {
    return null
  }

  return {
    id: thingId,
    includes,
    sorts: await Promise.all(
      Object.keys(ListingSort.sorts).map(async name => [
        name,
        await ListingSort.sorts[name](scope, thingId, spec)
      ])
    )
  }
}

export const descriptionToListingMap = (declarativeUpdate: any) => {
  const id = (declarativeUpdate && declarativeUpdate.id) || ''
  const includes = (declarativeUpdate && declarativeUpdate.includes) || []
  const sorts: ReadonlyArray<readonly [string, number]> =
    (declarativeUpdate && declarativeUpdate.sorts) || []
  // tslint:disable-next-line: readonly-array
  const results: any[] = []

  for (const listing of includes) {
    for (const [sortName, value] of sorts) {
      results.push([`${listing}/${sortName}`, [[id, value]]])
    }
  }

  return results
}

export async function indexThing(
  peer: NabIndexer,
  id: string
): Promise<string> {
  const startedAt = new Date().getTime()
  const scope = peer.newScope()
  let fetchedEnd = 0
  let diffEnd = 0

  try {
    const description = await describeThingId(scope, id)
    const listingMap: readonly any[] = descriptionToListingMap(description)

    const putGraphData: any = {}

    const souls = listingMap.map(item => {
      const [listingPath]: readonly [
        string,
        ReadonlyArray<readonly [string, number]>
      ] = item
      return ListingNode.soulFromPath(Config.tabulator, listingPath)
    })

    if (!souls.length) {
      // tslint:disable-next-line: no-console
      console.log('no souls', id, listingMap)
    }

    const nodes = {}

    await Promise.all(
      souls.map(soul =>
        scope.get(soul).then(node => {
          nodes[soul] = node
        })
      )
    )

    fetchedEnd = new Date().getTime()

    await Promise.all(
      listingMap.map(async item => {
        const [listingPath, updatedItems]: readonly [
          string,
          ReadonlyArray<readonly [string, number]>
        ] = item
        const soul = ListingNode.soulFromPath(Config.tabulator, listingPath)
        const existing = nodes[soul]
        const diff = await ListingNode.diff(existing, updatedItems as any, [])

        if (!diff) {
          return
        }
        putGraphData[soul] = {
          _: {
            '#': soul
          },
          ...diff
        }
      })
    )

    diffEnd = new Date().getTime()

    if (Object.keys(putGraphData).length) {
      await new Promise((ok, fail) => {
        const timeout = setTimeout(() => {
          off()
          fail(new Error('Write timeout'))
        }, WRITE_TIMEOUT)

        function done(): void {
          clearTimeout(timeout)
          ok()
          off()
        }

        const off = peer.graph.put(putGraphData, done)
      })
    }
  } catch (e) {
    // tslint:disable-next-line: no-console
    console.error('Indexer error', e.stack || e)
  } finally {
    scope.off()
  }

  const endedAt = new Date().getTime()
  // tslint:disable-next-line: no-console
  console.log('indexed', id, {
    diff: diffEnd - fetchedEnd,
    fetch: fetchedEnd - startedAt,
    total: endedAt - startedAt,
    write: endedAt - diffEnd
  })
  return id
}

export function idsToIndex(put: GunGraphData): readonly string[] {
  // tslint:disable-next-line: readonly-array
  const ids: any[] = []
  if (!put) {
    return ids
  }

  for (const soul in put) {
    if (!soul) {
      continue
    }
    const thingMatch = Schema.Thing.route.match(soul)
    const countsMatch = Schema.ThingVoteCounts.route.match(soul)
    if (countsMatch && countsMatch.tabulator !== Config.tabulator) {
      continue
    }
    const thingId = (thingMatch || countsMatch || {}).thingId || ''

    if (thingId && ids.indexOf(thingId) === -1) {
      ids.push(thingId)
    }
  }

  return ids
}
