import { GunNode, unpackNode } from '@chaingun/sea-client'
import { Listing } from '@notabug/peer'
import { always, ifElse, map, pipe, reduce, union } from 'ramda'

export const listingNodeToIds = ifElse(
  x => !!x,
  pipe<GunNode, GunNode, readonly string[]>(
    unpackNode,
    Listing.ListingNode.ids
  ),
  always([])
)

export const listingNodesToIds = pipe<
  readonly GunNode[],
  ReadonlyArray<readonly string[]>,
  readonly string[]
>(
  map(listingNodeToIds),
  reduce<readonly string[], readonly string[]>(union, [])
)
