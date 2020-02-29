import { GunGraphAdapter } from '@chaingun/sea-client'
import { Schema } from '@notabug/peer'
import { ThingMeta } from './ThingMeta'
import {
  GraphSigner,
  ListingUpdate,
  TabulatorThingChanges,
  ThingID
} from './types'

export class Tabulator {
  protected readonly adapter: GunGraphAdapter
  protected readonly meta: ThingMeta
  protected readonly pub: string
  protected put: GraphSigner

  constructor(adapter: GunGraphAdapter, pub: string, put: GraphSigner) {
    this.adapter = adapter
    this.meta = new ThingMeta(adapter, pub)
    this.pub = pub
    this.put = put
  }

  public async processChanges(
    changes: TabulatorThingChanges
  ): Promise<ListingUpdate[]> {
    const updates: ListingUpdate[] = []
    const entries = Object.entries(changes)

    if (!entries.length) {
      return updates
    }

    await Promise.all(
      entries.map(([thingId, change]) =>
        this.processChange(thingId, change).then(itemUpdates =>
          itemUpdates.forEach(up => updates.push(up))
        ).catch(e => {
          console.error("Error updating", thingId, e.stack)
        })
      )
    )

    return updates
  }

  public async processChange(
    thingId: ThingID,
    change: TabulatorThingChanges
  ): Promise<ListingUpdate[]> {
    const results = await this.meta.update(thingId, change)
    const { counts } = results
    const soul = Schema.ThingVoteCounts.route.reverse({
      thingId,
      tabulator: this.pub
    })

    if (!soul || !Object.keys(counts).length) {
      return results.listingUpdates
    }

    await this.put({
      [soul]: {
        _: {
          '#': soul,
          '>': {}
        },
        ...counts
      }
    })

    return results.listingUpdates
  }
}
