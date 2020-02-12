import {
  diffGunCRDT,
  GunGraphAdapter,
  GunGraphData,
  mergeGraph
} from '@chaingun/sea-client'

export function batchWriter(
  persist: GunGraphAdapter,
  interval = 500
): {
  readonly queueDiff: (changes: GunGraphData) => GunGraphData | undefined
  readonly writeBatch: () => Promise<void>
} {
  // tslint:disable-next-line: no-let
  let batch: GunGraphData = {}

  function queueDiff(changes: GunGraphData): GunGraphData | undefined {
    const diff = diffGunCRDT(changes, batch)
    batch = diff ? mergeGraph(batch, diff, 'mutable') : batch
    return diff
  }

  async function writeBatch(): Promise<void> {
    if (!Object.keys(batch).length) {
      return null
    }
    const toWrite = batch
    batch = {}

      await Promise.all(
        Object.entries(toWrite).map(async ([soul, node]) => {
          try {
            await persist.put({ [soul]: node })
          } catch(e) {
            console.error("Error saving", soul, e.stack)
            queueDiff({ [soul]: node })
          }
        })
      )
  }

  async function onInterval(): Promise<void> {
    await writeBatch()
    setTimeout(onInterval, interval)
  }

  setTimeout(onInterval, interval)

  return {
    queueDiff,
    writeBatch
  }
}
