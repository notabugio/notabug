import {
  ExpressLikeStore,
  LinguaWebcaClient,
  LinguaWebcaStore,
  webca as universe
} from '@lingua-webca/core'
import { AllHtmlEntities } from 'html-entities'
import { filter, map, pathOr, pipe, range, sortBy, propOr } from 'ramda'

const ID_BASE = 36
const entities = new AllHtmlEntities()

const getListingThings = pipe(
  pathOr<readonly any[]>([], ['data', 'children']),
  map(item => ({
    ...item.data,
    kind: item.kind
  })),
  filter(d => !!d)
)

function idRange(
  kind: string,
  lastId: string,
  count: number
): readonly string[] {
  const firstIdNum = parseInt(lastId, ID_BASE) + 1
  const lastIdNum = firstIdNum + count
  const idNums = range(firstIdNum, lastIdNum)
  return idNums.map(idNum => `${kind}_${idNum.toString(ID_BASE)}`)
}

const COMMENT_KIND = 't1'
const SUBMISSION_KIND = 't5'
const COMMENTS_PER_POLL =
  parseInt(process.env.INGEST_COMMENTS_PER_POLL || '', 10) || 90
const SUBMISSIONS_PER_POLL =
  parseInt(process.env.INGEST_SUBMISSIONS_PER_POLL || '', 10) || 10

export function createSaiditIngest(
  webca: LinguaWebcaClient = universe,
  host: string = 'saidit.net'
): LinguaWebcaStore {
  const app = new ExpressLikeStore()

  app.get(
    '/things/:lastSubmissionId/comments/:lastCommentId',
    async (req, res) => {
      const { lastSubmissionId, lastCommentId } = req.params
      const commentIds = idRange(COMMENT_KIND, lastCommentId, COMMENTS_PER_POLL)
      const submissionIds = idRange(
        SUBMISSION_KIND,
        lastSubmissionId,
        SUBMISSIONS_PER_POLL
      )
      const apiRes = await webca.get(
        `http://${host}/api/info.json?id=${[
          ...submissionIds,
          ...commentIds
        ].join(',')}`
      )
      const children = getListingThings(apiRes)

      res.json(children)
    }
  )

  // tslint:disable-next-line: variable-name
  app.post(`/things/:kind/new`, async (_req, res) => {
    // tslint:disable-next-line no-let
    // let previousId = lastIds[SUBMISSION_KIND]

    const config = await webca.get(
      `notabug://notabug.io/me/pages/config:saidit_ingest/yaml`
    )

    const previousSubmissionId =
      '' + (config && config[`newest_ingested_${SUBMISSION_KIND}`]) || '0'

    const previousCommentId =
      '' + (config && config[`newest_ingested_${COMMENT_KIND}`]) || '0'

    const nativeThings = await app.client.get(
      // `/things/${kind}/after/${previousId}`
      `/things/${previousSubmissionId}/comments/${previousCommentId}`
    )

    if (
      !nativeThings.length &&
      parseInt(previousCommentId, ID_BASE) < parseInt('4tvm', ID_BASE)
    ) {
      const lastIdNum =
        parseInt(previousCommentId, ID_BASE) + COMMENTS_PER_POLL - 1
      const lastId = lastIdNum.toString(ID_BASE)
      console.log('comment drought advance')
      await webca.patch(
        `notabug://notabug.io/me/pages/config:saidit_ingest/yaml`,
        {
          [`newest_ingested_${COMMENT_KIND}`]: lastId
        }
      )
    }

    // tslint:disable-next-line: readonly-array
    const things: any[] = []

    for (const item of sortBy<typeof nativeThings[0]>(
      propOr(0, 'created_utc'),
      nativeThings
    )) {
      if (!item) {
        continue
      }

      // tslint:disable-next-line: no-let
      let thing: any
      const nativeId = item.id

      if (item.kind === SUBMISSION_KIND) {
        if (item.author === '[deleted]' || item.selftext === '[removed]') {
          continue
        }

        thing = {
          author: `${item.author}@SaidIt`,
          body: entities.decode(item.selftext || ''),
          kind: 'submission',
          timestamp: item.created_utc * 1000,
          title: entities.decode(item.title),
          topic: `SaidIt.${item.subreddit}`,
          url: item.selftext ? '' : item.url || ''
        }
      } else if (item.kind === COMMENT_KIND) {
        const linkId = (item.link_id || '').split('_').pop()
        const [replyToKind, replyToSaiditId] = (item.parent_id || '').split('_')

        const submissionThingId =
          linkId &&
          (await webca.get(
            `notabug://notabug.io/me/lists/saidit:${SUBMISSION_KIND}/${linkId}`
          ))
        const replyToThingId =
          replyToSaiditId &&
          (await webca.get(
            `notabug://notabug.io/me/lists/saidit:${replyToKind}/${replyToSaiditId}`
          ))

        if (!submissionThingId) {
          // tslint:disable-next-line: no-console
          console.log('skip item', item)
          await webca.patch(
            `notabug://notabug.io/me/pages/config:saidit_ingest/yaml`,
            {
              [`newest_ingested_${item.kind}`]: nativeId
            }
          )
          continue
        }

        thing = {
          author: `${item.author}@SaidIt`,
          body: entities.decode(item.body || ''),
          kind: 'comment',
          opId: submissionThingId,
          replyToId: replyToThingId || submissionThingId,
          timestamp: item.created_utc * 1000,
          topic: `SaidIt.${item.subreddit}`
        }
      }

      if (!thing) {
        console.log('wtf', item)
        continue
      }

      things.push(thing)

      const thingId = await webca.post(
        `notabug://notabug.io/me/submit/${thing.kind}/${thing.topic}`,
        thing
      )

      // tslint:disable-next-line: no-console
      console.log('posted', thing.kind, thingId)

      await webca.put(
        `notabug://notabug.io/me/lists/saidit:${item.kind}/${nativeId}`,
        thingId
      )

      await webca.patch(
        `notabug://notabug.io/me/pages/config:saidit_ingest/yaml`,
        {
          [`newest_ingested_${item.kind}`]: nativeId
        }
      )

      await new Promise(ok => setTimeout(ok, 1500))
    }

    res.json(things)
  })

  return app.request
}

export const SaiditIngestStore = {
  create: createSaiditIngest
}
