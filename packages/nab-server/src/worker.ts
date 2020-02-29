// tslint:disable-next-line: no-var-requires
require('dotenv').config()
import { GunGraphData } from '@chaingun/sea-client'
import GunSocketClusterWorker from '@chaingun/socketcluster-worker'
import { Validation } from '@notabug/nab-wire-validation'
import { Schema } from '@notabug/peer'
import compression from 'compression'
// tslint:disable-next-line: no-implicit-dependencies
import express, { Request } from 'express'
import fallback from 'express-history-api-fallback'
import Gun from 'gun'
import path from 'path'
import { RateLimiterIPCWorker } from './rate-limiter-ipc'

const DISABLE_VALIDATION = false

const suppressor = Validation.createSuppressor(Gun)

const RATE_LIMITER_PERIOD =
  parseInt(process.env.NAB_RATE_LIMITER_PERIOD, 10) || 60 * 30
const RATE_LIMITER_BYTES_PER_SECOND =
  parseInt(process.env.NAB_RATE_LIMITER_BYTES_PER_SECOND, 10) || 40
const RATE_LIMITER_SUBMISSION_MULTIPLIER =
  parseInt(process.env.NAB_RATE_LIMITER_SUBMISSION_MULTIPLIER, 10) || 5
const RATE_LIMITER_COMMENT_MULTIPLIER =
  parseInt(process.env.NAB_RATE_LIMITER_COMMENT_MULTIPLIER, 10) || 3
const RATE_LIMITER_CHAT_MULTIPLIER =
  parseInt(process.env.NAB_RATE_LIMITER_CHAT_MULTIPLIER, 10) || 1
const RATE_LIMITER_SKIP = (process.env.NAB_RATE_LIMITER_SKIP || '')
  .split(',')
  .map(s => s.trim())

const rateLimiter = new RateLimiterIPCWorker({
  duration: 1 * RATE_LIMITER_PERIOD,
  keyPrefix: 'nab-rate-limiter',
  points: RATE_LIMITER_BYTES_PER_SECOND * RATE_LIMITER_PERIOD
})

const staticMedia = express.Router()
const root = path.join(__dirname, '..', '..', 'htdocs')
staticMedia.use(express.static(root, { index: false }))

const dataRe = /things\/.*\/data/

export class NotabugWorker extends GunSocketClusterWorker {
  public setupExpress(): any {
    const app = super.setupExpress()
    app.use(compression())
    app.use(staticMedia)
    staticMedia.use(express.static(root, { index: false }))
    app.use(fallback('index.html', { root }))
    return app
  }

  protected async preprocessHttpPut(req: Request): Promise<void | boolean> {
    const graphData = req.body
    const address =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress
    const allowed = await this.throttlePuts(graphData, address)
    if (!allowed) {
      return false
    }
    return true
  }

  protected async validatePut(graph: GunGraphData): Promise<boolean> {
    if (DISABLE_VALIDATION) {
      return true
    }

    return suppressor.validate({
      '#': 'dummymsgid',
      put: graph
    })
  }

  protected publishInMiddleware(
    req: any,
    next: (arg0?: Error | boolean) => void
  ): void {
    const fn = super.publishInMiddleware.bind(this)

    this.throttleMiddleware(req, err => {
      if (err) {
        next(err)
      } else {
        fn(req, next)
      }
    })
  }

  protected throttleMiddleware(req: any, next: (arg0?: Error) => void): void {
    if (this.isAdmin(req.socket)) {
      next()
      return
    }

    if (!req.data || !req.data.put) {
      next()
      return
    }

    const graphData = req.data.put

    this.throttlePuts(graphData, req.socket.forwardedForAddress)
      .then(allowed =>
        allowed ? next() : next(new Error('Rate Limit Exceeded'))
      )
      .catch(err => next(err))
  }

  protected async throttlePuts(
    graphData: GunGraphData,
    address: string
  ): Promise<boolean> {
    // tslint:disable-next-line: no-let
    let contentLength = 0

    for (const soul in graphData) {
      if (dataRe.test(soul)) {
        const { authorId = '' } = Schema.ThingDataSigned.route.match(soul) || {}

        const data = graphData[soul]
        if (!data || (authorId && RATE_LIMITER_SKIP.includes(authorId))) {
          continue
        }

        // tslint:disable-next-line: no-let
        let multiplier = RATE_LIMITER_CHAT_MULTIPLIER

        if (data.kind === 'submission' || data.kind === 'wikipage') {
          multiplier = RATE_LIMITER_SUBMISSION_MULTIPLIER
        }

        if (data.kind === 'comment') {
          multiplier = RATE_LIMITER_COMMENT_MULTIPLIER
        }

        // tslint:disable-next-line: no-let
        let itemLength = 0
        itemLength += (data.title || '').length
        itemLength += (data.topic || '').length
        itemLength += (data.body || '').length
        itemLength += (data.url || '').length
        contentLength += Math.max(itemLength, 250) * multiplier
      }
    }

    if (!contentLength || !address) {
      return true
    }

    return rateLimiter
      .consume(address, contentLength)
      .then(() => true)
      .catch(res => {
        // tslint:disable-next-line: no-console
        console.error('rate limit exceeded', res, graphData)
        return false
      })
  }
}

// tslint:disable-next-line: no-unused-expression
new NotabugWorker()
