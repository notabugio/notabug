// tslint:disable: no-object-mutation no-let
import createAdapter from '@chaingun/node-adapters'
import {
  addMissingState,
  authenticate,
  ChangeSetEntry,
  graphSigner,
  GunGraphAdapter,
  GunGraphData,
  GunProcessQueue,
  unpackNode
} from '@chaingun/sea-client'
import { Config } from '@notabug/peer'
import { batchWriter } from './batch-writer'
import { describeDiff } from './describe-diff'
import { Indexer } from './Indexer'
import { Tabulator } from './Tabulator'

export async function startup(external: GunGraphAdapter): Promise<void> {
  const internal = createAdapter()
  const get = (soul: string) => internal.get(soul).then(unpackNode)
  const creds = await authenticate(
    {
      get
    },
    process.env.GUN_ALIAS,
    process.env.GUN_PASSWORD
  )
  const signer = graphSigner(creds)
  const writer = batchWriter(external)
  const put = (graph: GunGraphData) =>
    signer(addMissingState(graph)).then(writer.queueDiff)
  const indexer = new Indexer(internal, creds.pub, put)
  const tabulator = new Tabulator(internal, creds.pub, put)
  const changeQueue = new GunProcessQueue<ChangeSetEntry>()
  const oracles = await get('oracles')
  const from = (oracles && oracles.indexer) || ''
  let lastKey = from

  Config.update({
    indexer: creds.pub,
    tabulator: creds.pub
  })

  async function processChange(entry: ChangeSetEntry): Promise<ChangeSetEntry> {
    // TODO: timestamp from key
    const [key, diff] = entry
    const startedAt = new Date().getTime()

    const changes = describeDiff(diff)

    function writeStatus(): Promise<GunGraphData> {
      return internal.put({
        oracles: {
          _: {
            '#': 'oracles',
            '>': {
              indexer: startedAt
            }
          },
          indexer: key
        }
      })
    }

    if (!changes) {
      await writeStatus()
      return entry
    }

    const updates = await tabulator.processChanges(changes)
    const tabulatedAt = new Date().getTime()

    await indexer.processUpdates(updates)
    await writeStatus()

    const indexedAt = new Date().getTime()
    const tabulated = tabulatedAt - startedAt
    const indexed = indexedAt - tabulatedAt
    const total = indexedAt - startedAt

    // tslint:disable-next-line: no-console
    console.log({
      key,
      tabulated,
      indexed,
      changes,
      listings: updates.length,
      total
    })

    return entry
  }

  changeQueue.middleware.use(processChange)

  external.onChange(change => {
    const [key] = change
    if (key > lastKey) {
      lastKey = key
      changeQueue.enqueue(change)
      changeQueue.process()
    }
  }, from)
}
