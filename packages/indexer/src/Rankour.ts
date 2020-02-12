// tslint:disable: readonly-array
import { GunGraphAdapter, GunNode, unpackNode } from '@chaingun/sea-client'
import {
  RankourListingItem,
  RankourListingSoul,
  RankourSortValue,
  RankourThingId
} from './types'

interface RankourListing {
  readonly byId: Record<RankourThingId, RankourListingItem>
  readonly byKey: Record<string, RankourListingItem>
  readonly sorted: RankourListingItem[]
}

export class Rankour {
  protected readonly listingSize: number
  protected readonly adapter: GunGraphAdapter
  protected readonly cache: Record<RankourListingSoul, RankourListing>

  constructor(adapter: GunGraphAdapter, listingSize = 1000) {
    this.cache = {}
    this.adapter = adapter
    this.listingSize = listingSize
    this.updateListing = this.updateListing.bind(this)
    this.update = this.update.bind(this)
  }

  public has(listingSoul: RankourListingSoul): boolean {
    return listingSoul in this.cache
  }

  public async update(
    listingSoul: RankourListingSoul,
    thingId: RankourThingId,
    sortValue: RankourSortValue
  ): Promise<RankourListingItem | null> {
    await this.load(listingSoul)
    return this.upsert(listingSoul, thingId, sortValue)
  }

  public updateListing(nodeData: GunNode): void {
    const soul = nodeData && nodeData._ && nodeData._['#']

    if (!this.has(soul)) {
      return
    }

    const node = unpackNode(nodeData)

    for (const key in node) {
      if (!key || key === '_') {
        continue
      }

      const data = node[key]

      if (!data) {
        continue
      }

      const [id, sortValStr] = data.split(',')

      if (!id || !sortValStr) {
        continue
      }

      this.upsert(soul, id, parseFloat(sortValStr), key)
    }
  }

  protected upsert(
    listingSoul: RankourListingSoul,
    thingId: RankourThingId,
    sortValue: RankourSortValue,
    key?: string
  ): RankourListingItem | null {
    const listing = this.cache[listingSoul]

    if (!listing) {
      return null
    }

    const { byId, byKey, sorted } = listing
    const existing = byId[thingId]

    if (existing) {
      const existingValue = existing[3]

      if (existingValue === sortValue) {
        return null
      }

      const existingPosition = getSortPosition(sorted, existingValue, existing)

      if (existingPosition >= 0) {
        sorted.splice(existingPosition, 1)
      }

      existing[3] = sortValue

      // TODO: this can be optimized with existingPosition and sort value diff
      const nextPosition = getSortPosition(sorted, sortValue)
      sorted.splice(nextPosition, 0, existing)
      return existing
    } else {
      const nextPosition = getSortPosition(sorted, sortValue)

      if (key || sorted.length < this.listingSize) {
        let thingKey = key
        let nextIdx = sorted.length + 1

        while (!thingKey) {
          const nextKey = `${nextIdx}`
          if (byKey[nextKey]) {
            // console.error('key exists', nextKey, listingSoul)
            nextIdx++
          } else {
            thingKey = nextKey
          }
        }

        const newItem: RankourListingItem = [
          listingSoul,
          thingKey,
          thingId,
          sortValue
        ]
        byId[thingId] = newItem
        sorted.splice(nextPosition, 0, newItem)
        byKey[thingKey] = newItem
        return newItem
      } else if (nextPosition < this.listingSize) {
        const toReplace = sorted.pop()

        if (!toReplace) {
          return null
        }

        const replacedId = toReplace[2]
        delete byId[replacedId]
        toReplace[2] = thingId
        toReplace[3] = sortValue
        byId[thingId] = toReplace
        sorted.splice(nextPosition, 0, toReplace)
        return toReplace
      }

      // Listing full
      return null
    }
  }

  protected async load(listingSoul: string): Promise<void> {
    if (this.cache[listingSoul]) {
      return
    }

    this.cache[listingSoul] = {
      byId: {},
      byKey: {},
      sorted: []
    }

    this.updateListing(await this.adapter.get(listingSoul))
  }
}

function getSortPosition(
  sorted: RankourListingItem[],
  sortValue: number,
  existing?: RankourListingItem
): number {
  if (existing) {
    // Todo this could be optimized to use insertion sort
    return sorted.indexOf(existing)
  }

  return binarySearch(sorted, sortValue)
}

export const binarySearch = (items: RankourListingItem[], insertVal) => {
  // based on https://stackoverflow.com/a/29018745
  let m = 0
  let n = items.length - 1

  while (m <= n) {
    // tslint:disable-next-line: no-bitwise
    const k = (n + m) >> 1
    const compareVal = items[k][3]

    if (insertVal > compareVal) {
      m = k + 1
    } else if (insertVal < compareVal) {
      n = k - 1
    } else {
      return k
    }
  }

  if (m === 0) {
    return 0
  }

  return m - 1
}
