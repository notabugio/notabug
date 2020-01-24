// tslint:disable-next-line: no-var-requires
require('dotenv').config()
import { GunGraphData } from '@chaingun/sea-client'
import GunSocketClusterWorker from '@chaingun/socketcluster-worker'
import { Validation } from '@notabug/nab-wire-validation'
import compression from 'compression'
// tslint:disable-next-line: no-implicit-dependencies
import express from 'express'
import fallback from 'express-history-api-fallback'
import Gun from 'gun'
import path from 'path'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { NabIndexer } from './indexer'
import { NabTabulator } from './tabulator'

const DISABLE_VALIDATION = false

const suppressor = Validation.createSuppressor(Gun)

const PERIOD = 60 * 30 // 30m

const rateLimiter = new RateLimiterMemory({
  duration: 1 * PERIOD,
  points: 20 * PERIOD
})

const staticMedia = express.Router()
const root = path.join(__dirname, '..', '..', 'htdocs')
staticMedia.use(express.static(root, { index: false }))

const dataRe = /things\/.*\/data/

export class NotabugWorker extends GunSocketClusterWorker {
  constructor(...args: any) {
    super(...args)

    if (this.id === 1) {
      new NabTabulator(this).start()
    }

    if (this.id === 2) {
      new NabIndexer(this).start()
    }
  }

  public setupExpress(): any {
    const app = super.setupExpress()
    app.use(compression())
    app.use(staticMedia)
    staticMedia.use(express.static(root, { index: false }))
    app.use(fallback('index.html', { root }))
    return app
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

    // tslint:disable-next-line: no-let
    let contentLength = 0

    for (const soul in graphData) {
      if (dataRe.test(soul)) {
        // tslint:disable-next-line: no-console
        console.log('data soul', soul)

        const data = graphData[soul]
        if (!data) {
          continue
        }

        // tslint:disable-next-line: no-let
        let multiplier = 1

        if (data.kind === 'submission' || data.kind === 'wikipage') {
          multiplier = 5
        }

        if (data.kind === 'comment') {
          multiplier = 3
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

    if (!contentLength || !req.socket.forwardedForAddress) {
      next()
      return
    }

    rateLimiter
      .consume(req.socket.forwardedForAddress, contentLength)
      .then(() => {
        next()
      })
      .catch(res => {
        // tslint:disable-next-line: no-console
        console.error('rate limit exceeded', res, graphData)
        next(new Error('Rate Limit Exceeded'))
      })
  }
}

// tslint:disable-next-line: no-unused-expression
new NotabugWorker()
