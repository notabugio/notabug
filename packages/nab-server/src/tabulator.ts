// tslint:disable: readonly-keyword no-object-mutation
import { GunGraphData, GunProcessQueue, unpackNode } from '@chaingun/sea-client'
import { CommentCommand, Config, Schema, ThingDataNode } from '@notabug/peer'
import { mergeDeepLeft } from 'ramda'
import { NotabugClient } from './client'
import { NotabugWorker } from './worker'

const WRITE_TIMEOUT = 60000

type ChangeSetEntry = readonly [string, GunGraphData]

interface CommandMapNode {
  [key: string]: CommandMapNode | number
}

interface CommandMap {
  [authorId: string]: CommandMapNode
}

interface TabulatorThingChanges {
  ups?: number
  downs?: number
  comments?: number
  replies?: number
  commandMap?: CommandMap
}

interface TabulatorChanges {
  [thingId: string]: TabulatorThingChanges
}

export class NabTabulator extends NotabugClient {
  protected readonly diffTabulatorQueue: GunProcessQueue<any>

  constructor(worker: NotabugWorker) {
    super(worker)

    this.diffTabulatorQueue = new GunProcessQueue<ChangeSetEntry>()
    this.diffTabulatorQueue.middleware.use(entry => processDiff(this, entry))
  }

  public start(): Promise<void> {
    return this.authenticate()
      .then(async ({ pub }) => {
        Config.update({
          indexer: process.env.NAB_INDEXER || pub,
          tabulator: pub
        })

        const oracles = await this.readNode('oracles')
        const from = (oracles && oracles.tabulator) || ''

        this.worker.changelogFeed.feed((key: string, diff: GunGraphData) => {
          this.diffTabulatorQueue.enqueue([key, diff])
          this.diffTabulatorQueue.process()
        }, from)

        // tslint:disable-next-line: no-console
        console.log('---Started tabulator---')
      })
      .catch(e => {
        // tslint:disable-next-line: no-console
        console.warn('Unable to authenticate tabulator', e)
      })
  }
}

export async function processDiff(
  peer: NabTabulator,
  entry: ChangeSetEntry
): Promise<void> {
  const [key, diff] = entry
  const startedAt = new Date().getTime()
  const changes = describeDiff(diff)

  if (changes) {
    await persistChanges(peer, changes)
    await peer.worker.internalAdapter.put({
      oracles: {
        _: {
          '#': 'oracles',
          '>': {
            tabulator: startedAt
          }
        },
        tabulator: key
      }
    })
    const endedAt = new Date().getTime()
    // tslint:disable-next-line: no-console
    console.log('tabulated', endedAt - startedAt, changes)
  }
}

export function describeDiff(diff: GunGraphData): TabulatorChanges | null {
  const changes: TabulatorChanges = {}

  for (const soul in diff) {
    if (!soul) {
      continue
    }

    const votesUpMatch = Schema.ThingVotesUp.route.match(soul)

    if (votesUpMatch) {
      const { _, ...votes } = diff[soul]
      const upsCount = Object.keys(votes).length
      const { thingId } = votesUpMatch
      const thingChanges: TabulatorThingChanges =
        changes[thingId] || (changes[thingId] = {})
      thingChanges.ups = (thingChanges.ups || 0) + upsCount
      continue
    }

    const votesDownMatch = Schema.ThingVotesDown.route.match(soul)

    if (votesDownMatch) {
      const { _, ...votes } = diff[soul]
      const downsCount = Object.keys(votes).length
      const { thingId } = votesDownMatch
      const thingChanges: TabulatorThingChanges =
        changes[thingId] || (changes[thingId] = {})
      thingChanges.downs = (thingChanges.downs || 0) + downsCount

      continue
    }

    const thingDataMatch =
      Schema.ThingData.route.match(soul) ||
      Schema.ThingDataSigned.route.match(soul)

    if (thingDataMatch) {
      const { thingId } = thingDataMatch
      const thingData = unpackNode(diff[soul])
      const { replyToId } = thingData

      if (replyToId && ThingDataNode.isCommand(thingData)) {
        const commandMap = CommentCommand.map(({
          [thingId]: thingData
        } as unknown) as any)
        const thingChanges: TabulatorThingChanges =
          changes[replyToId] || (changes[replyToId] = {})
        thingChanges.commandMap = mergeDeepLeft(
          commandMap,
          thingChanges.commandMap || {}
        )
      }

      continue
    }

    const thingMatch = Schema.Thing.route.match(soul)

    if (thingMatch) {
      const thing = diff[soul] // thing diffs can't be partial
      const opSoul = (thing && thing.op && thing.op['#']) || ''
      const replyToSoul = (thing && thing.replyTo && thing.replyTo['#']) || ''

      if (opSoul) {
        const { thingId: opId } = Schema.Thing.route.match(opSoul) || {}
        const thingChanges: TabulatorThingChanges =
          changes[opId] || (changes[opId] = {})
        thingChanges.comments = (thingChanges.comments || 0) + 1
      }

      if (replyToSoul) {
        const { thingId: replyToId } =
          Schema.Thing.route.match(replyToSoul) || {}
        const thingChanges: TabulatorThingChanges =
          changes[replyToId] || (changes[replyToId] = {})
        thingChanges.replies = (thingChanges.replies || 0) + 1
      }

      continue
    }
  }

  return Object.keys(changes).length ? changes : null
}

export async function persistChanges(
  peer: NabTabulator,
  changes: TabulatorChanges
): Promise<void> {
  const tabulator = peer.user().is.pub

  for (const thingId in changes) {
    if (!thingId) {
      continue
    }

    const diff: any = {}
    const thingChanges = changes[thingId]
    const soul = Schema.ThingVoteCounts.route.reverse({ thingId, tabulator })
    const existing: any = (soul && (await peer.readNode(soul))) || {}
    const score = (thingChanges.ups || 0) - (thingChanges.downs || 0)

    if (thingChanges.ups) {
      diff.up = (existing.up || 0) + thingChanges.ups
    }

    if (thingChanges.downs) {
      diff.down = (existing.down || 0) + thingChanges.downs
    }

    if (thingChanges.comments) {
      diff.comment = (existing.comment || 0) + thingChanges.comments
    }

    if (thingChanges.replies) {
      diff.replies = (existing.replies || 0) + thingChanges.replies
    }

    if (score) {
      diff.score = (existing.score || 0) + score
    }

    if (thingChanges.commandMap) {
      diff.commands = JSON.stringify(
        mergeDeepLeft(thingChanges.commandMap, existing.commands || {})
      )
    }

    await new Promise((ok, fail) => {
      const timeout = setTimeout(
        () => fail(new Error('Write timeout')),
        WRITE_TIMEOUT
      )

      function done(): void {
        clearTimeout(timeout)
        ok()
      }

      if (soul) {
        peer.get(soul).put(diff, done)
      } else {
        done()
      }
    })
  }
}
