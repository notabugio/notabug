import {
  ExpressLikeStore,
  LinguaWebcaClient,
  webca as universe
} from '@lingua-webca/core'
import { addMissingState } from '@chaingun/sea-client'
import { Schema } from '@notabug/peer'
import objHash from 'object-hash'

export function submitApi(
  app: ExpressLikeStore,
  host: string,
  webca: LinguaWebcaClient = universe
): ExpressLikeStore {
  app.post(
    `/content(/user/:authorId)/submit/:kind(/:topic)`,
    async (req, res) => {
      const { authorId, topic = '', kind } = req.params
      const {
        author = '',
        body = '',
        title,
        url,
        timestamp = new Date().getTime(),
        opId = '',
        replyToId = ''
      } = req.body

      const data: any = {
        author,
        authorId,
        body,
        kind,
        opId,
        replyToId,
        timestamp,
        topic
      }

      if (title) {
        data.title = title
      }

      if (url) {
        data.url = url
      }

      const originalHash = objHash(data)
      const thingId = objHash({
        authorId: authorId || undefined,
        kind,
        opId: opId || undefined,
        originalHash,
        replyToId: replyToId || undefined,
        timestamp,
        topic: topic || undefined
      })
      const thingSoul = Schema.Thing.route.reverse({ thingId }) || ''

      const dataSoul =
        (authorId
          ? Schema.ThingDataSigned.route.reverse({ thingId, authorId })
          : Schema.ThingData.route.reverse({ thingId: originalHash })) || ''

      const thingDataNode: any = {
        _: {
          '#': dataSoul,
          '>': {}
        },
        ...data
      }

      const thingNode: any = {
        _: {
          '#': thingSoul,
          '>': {}
        },
        allcomments: {
          '#': Schema.ThingAllComments.route.reverse({ thingId }) as string
        },
        comments: {
          '#': Schema.ThingComments.route.reverse({ thingId }) as string
        },
        data: {
          '#': dataSoul
        },
        id: thingId,
        kind,
        originalHash,
        timestamp,
        votesdown: {
          '#': Schema.ThingVotesDown.route.reverse({ thingId }) as string
        },
        votesup: {
          '#': Schema.ThingVotesUp.route.reverse({ thingId }) as string
        }
      }

      if (topic) {
        thingNode.topic = {
          '#': Schema.Topic.route.reverse({ topicName: topic }) as string
        }
      }

      if (authorId) {
        thingNode.author = { '#': `~${authorId}` }
      }

      if (opId) {
        thingNode.op = {
          '#': Schema.Thing.route.reverse({ thingId: opId }) as string
        }
      }

      if (replyToId) {
        thingNode.replyTo = {
          '#': Schema.Thing.route.reverse({ thingId: replyToId }) as string
        }
      }

      const graphData = addMissingState({
        [thingSoul]: thingNode,
        [dataSoul]: thingDataNode
      })

      await webca.patch(`gun://${host}/`, graphData)

      res.json(thingId)
    }
  )

  return app
}
