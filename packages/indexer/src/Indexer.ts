import { GunGraphAdapter } from '@chaingun/sea-client'
import { Rankour } from './Rankour'
import { GraphSigner, ListingUpdate } from './types'

export class Indexer {
  protected readonly adapter: GunGraphAdapter
  protected readonly rankour: Rankour
  protected readonly pub: string
  protected put: GraphSigner

  constructor(adapter: GunGraphAdapter, pub: string, put: GraphSigner) {
    this.adapter = adapter
    this.rankour = new Rankour(adapter)
    this.pub = pub
    this.put = put
    this.processUpdate = this.processUpdate.bind(this)
    this.processUpdates = this.processUpdates.bind(this)
  }

  public async processUpdate(update: ListingUpdate): Promise<void> {
    const [listingSoul, thingId, sortVal, timestamp] = update
    const updated = await this.rankour.update(listingSoul, thingId, sortVal)

    if (!updated) {
      return
    }

    const key = updated[1]

    await this.put({
      [listingSoul]: {
        _: {
          '#': listingSoul,
          '>': {
            [key]: timestamp
          }
        },
        [key]: `${thingId},${sortVal || 0}`
      }
    })
  }

  public async processUpdates(updates: ListingUpdate[]): Promise<void> {
    if (!updates) {
      return Promise.resolve()
    }

    return Promise.all(updates.map(this.processUpdate)).then()
  }
}
