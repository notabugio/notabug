import { addMissingState, GunGraphData, unpackNode } from '@chaingun/sea-client'
import {
  ExpressLikeStore,
  LinguaWebcaClient,
  webca as universe
} from '@lingua-webca/core'
import { Schema, ThingDataNode } from '@notabug/peer'
import yaml from 'js-yaml'
import { listingNodeToIds } from '../utils'

export function contentApi(
  app: ExpressLikeStore,
  indexer: string,
  host: string,
  webca: LinguaWebcaClient = universe
): ExpressLikeStore {
  const tabulator = indexer

  app.get('/content/things/:thingId/comments/:sort', async (req, res) => {
    const { thingId } = req.params
    const soul = Schema.ThingCommentsListing.route.reverse({
      thingId
    })
    const node = await webca.get(`gun://${host}/${soul}`)
    const ids = listingNodeToIds(node)
    const things = await Promise.all(
      ids.map((id: string) => app.client.get(`/things/${id}`))
    )

    res.json(things)
  })

  app.get('/content/things/:thingId', async (req, res) => {
    const { thingId } = req.params
    const thingSoul = Schema.Thing.route.reverse({ thingId })
    const countsSoul = Schema.ThingVoteCounts.route.reverse({
      tabulator,
      thingId
    })
    const [thing, rawCounts] = await Promise.all([
      webca.get(`gun://${host}/${thingSoul}`),
      webca.get(`gun://${host}/${countsSoul}`)
    ])
    const counts = unpackNode(rawCounts)
    const dataSoul = thing && thing.data && thing.data['#']

    if (!dataSoul) {
      throw new Error('No data soul')
    }

    const rawData = await webca.get(`gun://${host}/${dataSoul}`)
    const data = unpackNode(rawData)

    res.json({
      counts,
      data,
      thing
    })
  })

  app.get(`/content/user/:authorId/pages/:name/yaml`, async (req, res) => {
    const { authorId, name } = req.params
    const rawNode = await app.client.get(
      `/nodes/user/${authorId}/pages/${name}`
    )
    const node = rawNode ? unpackNode(rawNode) : null
    const body: string = ThingDataNode.body(node) || ''
    const data = yaml.safeLoad(body)

    res.json(data)
  })

  app.get(`/content/user/:authorId/lists/:name/:key`, async (req, res) => {
    const { authorId, key, name } = req.params
    const soul =
      Schema.AuthorThingList.route.reverse({
        authorId,
        name
      }) || ''

    const response = await webca.get(
      `gun://${host}/key/${key}/from_node/${soul}`
    )

    const node = response ? unpackNode(response) : null
    const thingSoul = (node && node[key] && node[key]['#']) || ''
    const { thingId = '' } = Schema.Thing.route.match(thingSoul) || {}

    res.json(thingId)
  })

  app.put(`/content/user/:authorId/lists/:name/:key`, async (req, res) => {
    const { authorId, key, name } = req.params
    const thingId = req.body

    const soul =
      Schema.AuthorThingList.route.reverse({
        authorId,
        name
      }) || ''
    const thingSoul = Schema.Thing.route.reverse({ thingId }) || ''

    const graphData: GunGraphData = {
      [soul]: {
        _: {
          '#': soul,
          '>': {}
        },
        [key]: thingSoul
          ? {
              '#': thingSoul
            }
          : null
      }
    }

    const response = await webca.patch(
      `gun://${host}/`,
      addMissingState(graphData)
    )

    res.json(response)
  })

  app.patch(`/content/user/:authorId/lists/:name`, async (req, res) => {
    const { authorId, name } = req.params
    const soul =
      Schema.AuthorThingList.route.reverse({
        authorId,
        name
      }) || ''
    const data = addMissingState({
      [soul]: {
        ...req.body
      }
    })
    const response = await webca.patch(`gun://${host}/`, data)

    res.json(response)
  })

  app.patch(`/content/user/:authorId/pages/:name/yaml`, async (req, res) => {
    const { authorId, name } = req.params
    const rawNode = await app.client.get(
      `/nodes/user/${authorId}/pages/${name}`
    )
    const node = rawNode ? unpackNode(rawNode) : null
    const body: string = ThingDataNode.body(node) || ''
    const data = yaml.safeLoad(body)
    const modified = { ...data, ...req.body }
    const newBody = yaml.safeDump(modified)
    const soul = node && node._ && node._['#']

    const graphData = addMissingState({
      [soul]: {
        _: {
          '#': soul,
          '>': {}
        },
        body: newBody
      }
    })

    const response = await webca.put(`gun://${host}/`, graphData)

    res.json(response)
  })

  /*
  app.get('/t/:topic/:sort/things', async (req, res) => {
    const listingPath = `/t/${req.params.topic}/${req.params.sort}`
    const { ids } = await app.client.get(listingPath)
    const query = parseQuery(req.query || '')
    const offset = parseInt(query.offset as string, 10) || 0
    const limit = parseInt(query.limit as string, 10) || 25
    const things = await Promise.all(
      ids
        .slice(offset, offset + limit)
        .map(([thingId]: readonly [string, number]) =>
        app.client.get(`/things/${thingId}`)
        )
    )
    res.json(things)
  })
  */

  return app
}
