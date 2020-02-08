import { GunNode, unpackNode } from '@chaingun/sea-client'
import {
  ExpressLikeStore,
  LinguaWebcaClient,
  webca as universe
} from '@lingua-webca/core'
import { Listing, Schema } from '@notabug/peer'
import { flatten } from 'ramda'
import { listingNodesToIds } from '../utils'

export function mirrorApi(
  app: ExpressLikeStore,
  indexer: string,
  host: string,
  webca: LinguaWebcaClient = universe
): ExpressLikeStore {
  const tabulator = indexer

  app.get(`/mirror/t/:topic`, async (req, res) => {
    const nodes = await Promise.all(
      Object.keys(Listing.ListingSort.sorts).map(sort =>
        app.client.get<GunNode>(`/nodes/t/${req.params.topic}/${sort}`)
      )
    )
    const ids = listingNodesToIds(nodes)

    res.json({
      ids,
      nodes
    })
  })

  app.get(`/mirror/domain/:domain`, async (req, res) => {
    const nodes = await Promise.all(
      Object.keys(Listing.ListingSort.sorts).map(sort =>
        app.client.get<GunNode>(`/nodes/domain/${req.params.domain}/${sort}`)
      )
    )
    const ids = listingNodesToIds(nodes)

    res.json({
      ids,
      nodes
    })
  })

  app.get(`/mirror/user/:authorId`, async (req, res) => {
    const listingNodes = await Promise.all(
      flatten(
        Object.keys(Listing.ListingSort.sorts).map(sort =>
          Listing.ProfileListing.tabs.map((type: string) => [
            app.client.get<GunNode>(
              `/nodes/user/${req.params.authorId}/replies/${type}/${sort}`
            ),
            app.client.get<GunNode>(
              `/nodes/user/${req.params.authorId}/${type}/${sort}`
            )
          ])
        )
      )
    )
    const ids = listingNodesToIds(listingNodes)
    const userNode = await webca.get(`gun://${host}/~${req.params.authorId}`)
    const alias = (userNode && unpackNode(userNode).alias) || ''
    const aliasNode = alias ? await webca.get(`gun://${host}/~@${alias}`) : null
    const nodes = [aliasNode, userNode, ...listingNodes].filter(x => !!x)

    res.json({
      ids,
      nodes
    })
  })

  app.get('/mirror/things/:thingId/comments', async (req, res) => {
    const nodes = await Promise.all(
      Object.keys(Listing.ListingSort.sorts).map(sort =>
        app.client.get<GunNode>(
          `/nodes/things/${req.params.thingId}/comments/${sort}`
        )
      )
    )
    const ids = listingNodesToIds(nodes)

    res.json({
      ids,
      nodes
    })
  })

  app.get('/mirror/things/:thingId', async (req, res) => {
    const { thingId } = req.params
    const thingSoul = Schema.Thing.route.reverse({ thingId })
    const upSoul = Schema.ThingVotesUp.route.reverse({
      thingId
    })
    const downSoul = Schema.ThingVotesUp.route.reverse({
      thingId
    })
    const countsSoul = Schema.ThingVoteCounts.route.reverse({
      tabulator,
      thingId
    })
    const [thing, rawCounts, upsNode, downsNode] = await Promise.all([
      webca.get(`gun://${host}/${thingSoul}`),
      webca.get(`gun://${host}/${countsSoul}`),
      webca.get(`gun://${host}/${upSoul}`),
      webca.get(`gun://${host}/${downSoul}`)
    ])
    const dataSoul = thing && thing.data && thing.data['#']
    const rawData = dataSoul
      ? await webca.get(`gun://${host}/${dataSoul}`)
      : null
    const data = unpackNode(rawData)
    const basicNodes = [thing, rawData, rawCounts, upsNode, downsNode].filter(
      x => !!x
    )
    const counts = unpackNode(rawCounts)

    if (counts && counts.comments) {
      const { nodes, ids } = await app.client.get(
        `/mirror/things/:thingId/comments`
      )
      res.json({
        ids,
        nodes: [...basicNodes, ...nodes]
      })
    } else {
      res.json({
        data,
        ids: [],
        nodes: basicNodes,
        thing
      })
    }
  })

  return app
}
