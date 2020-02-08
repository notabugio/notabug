import { unpackNode } from '@chaingun/sea-client'
import {
  ExpressLikeStore,
  LinguaWebcaClient,
  webca as universe
} from '@lingua-webca/core'
import { Schema } from '@notabug/peer'

export function nodeApi(
  app: ExpressLikeStore,
  indexer: string,
  host: string,
  webca: LinguaWebcaClient = universe
): ExpressLikeStore {
  app.get('/nodes/t/:topic/:sort', async (req, res) => {
    const soul = Schema.TopicListing.route.reverse({
      indexer,
      sort: req.params.sort,
      topic: req.params.topic
    })
    const node = await webca.get(`gun://${host}/${soul}`)
    res.json(node)
  })

  app.get('/nodes/domain/:domain/:sort', async (req, res) => {
    const soul = Schema.DomainListing.route.reverse({
      domain: req.params.domain,
      indexer,
      sort: req.params.sort
    })
    const node = await webca.get(`gun://${host}/${soul}`)

    res.json(node)
  })

  app.get('/nodes/things/:thingId/comments/:sort', async (req, res) => {
    const { thingId } = req.params
    const soul = Schema.ThingCommentsListing.route.reverse({
      thingId
    })
    const node = await webca.get(`gun://${host}/${soul}`)

    res.json(node)
  })

  app.get(`/nodes/user/:authorId/pages/:name`, async (req, res) => {
    const { authorId, name } = req.params
    const rawPagesNode = await app.client.get(`/nodes/user/${authorId}/pages`)

    const pagesNode = rawPagesNode ? unpackNode(rawPagesNode) : null
    const thingSoul =
      (pagesNode && pagesNode[name] && pagesNode[name]['#']) || ''

    if (thingSoul) {
      const thingNode = await webca.get(`gun://${host}/${thingSoul}`)
      const thingDataSoul = thingNode && thingNode.data && thingNode.data['#']
      if (thingDataSoul) {
        const thingData = await webca.get(`gun://${host}/${thingDataSoul}`)

        res.json(thingData)
      } else {
        res.json(null)
      }
    } else {
      res.json(null)
    }
  })

  app.get('/nodes/user/:authorId/pages', async (req, res) => {
    const soul = Schema.AuthorPages.route.reverse({
      authorId: req.params.authorId
    })
    const node = await webca.get(`gun://${host}/${soul}`)

    res.json(node)
  })

  app.get('/nodes/user/:authorId/replies/:type/:sort', async (req, res) => {
    const soul = Schema.AuthorRepliesListing.route.reverse({
      authorId: req.params.authorId,
      indexer,
      sort: req.params.sort,
      type: req.params.type
    })
    const node = await webca.get(`gun://${host}/${soul}`)

    res.json(node)
  })

  app.get('/nodes/user/:authorId/:type/:sort', async (req, res) => {
    const soul = Schema.AuthorProfileListing.route.reverse({
      authorId: req.params.authorId,
      indexer,
      sort: req.params.sort,
      type: req.params.type
    })
    const node = await webca.get(`gun://${host}/${soul}`)

    res.json(node)
  })

  return app
}
