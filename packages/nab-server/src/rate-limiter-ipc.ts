// tslint:disable max-classes-per-file typedef member-access no-object-mutation object-literal-sort-keys readonly-keyword no-let no-delete only-arrow-functions ban-types
import { client as IPCClient, server as IPCServer } from 'fast-ipc'
import {
  IRateLimiterOptions,
  RateLimiterMemory,
  RateLimiterRes
} from 'rate-limiter-flexible'

const channel = 'rate_limiter_flexible'
let masterInstance = null

const workerProcessResponse = function(
  msg,
  resolve: Function,
  reject: Function
) {
  if (!msg || msg.channel !== channel || msg.keyPrefix !== this.keyPrefix) {
    return false
  }

  let res
  if (msg.data === null || msg.data === true || msg.data === false) {
    res = msg.data
  } else {
    res = new RateLimiterRes(
      msg.data.remainingPoints,
      msg.data.msBeforeNext,
      msg.data.consumedPoints,
      msg.data.isFirstInDuration // eslint-disable-line comma-dangle
    )
  }

  switch (msg.type) {
    case 'resolve':
      resolve(res)
      break
    case 'reject':
      reject(res)
      break
    default:
      throw new Error(`RateLimiterCluster: no such message type '${msg.type}'`)
  }

  return undefined
}

/**
 * Prepare options to send to master
 * Master will create rate limiter depending on options
 *
 * @returns {{points: *, duration: *, blockDuration: *, execEvenly: *, execEvenlyMinDelayMs: *, keyPrefix: *}}
 */
const getOpts = function() {
  return {
    points: this.points,
    duration: this.duration,
    blockDuration: this.blockDuration,
    execEvenly: this.execEvenly,
    execEvenlyMinDelayMs: this.execEvenlyMinDelayMs,
    keyPrefix: this.keyPrefix
  }
}

export class RateLimiterIPCWorker extends RateLimiterMemory {
  keyPrefix: any
  // tslint:disable-next-line: variable-name
  _initiated: boolean

  ipcClient: IPCClient

  constructor(opts: IRateLimiterOptions) {
    super(opts)

    this.ipcClient = new IPCClient(channel)

    process.setMaxListeners(0)

    this._initiated = false

    const rlOpts = getOpts.call(this)

    this.ipcClient.send(
      'init',
      [rlOpts.keyPrefix, JSON.stringify(rlOpts)],
      () => {
        this._initiated = true
      }
    )
  }

  consume(key, pointsToConsume = 1, options = {}) {
    return new Promise<RateLimiterRes>((resolve, reject) => {
      this.ipcClient.send(
        'consume',
        [
          this.keyPrefix,
          JSON.stringify({
            key,
            pointsToConsume,
            options
          })
        ],
        res => workerProcessResponse.call(this, res, resolve, reject)
      )
    })
  }

  penalty(key, points = 1, options = {}) {
    return new Promise<RateLimiterRes>((resolve, reject) => {
      this.ipcClient.send(
        'penalty',
        [
          this.keyPrefix,
          JSON.stringify({
            key,
            points,
            options
          })
        ],
        res => workerProcessResponse.call(this, res, resolve, reject)
      )
    })
  }

  reward(key, points = 1, options = {}) {
    return new Promise<RateLimiterRes>((resolve, reject) => {
      this.ipcClient.send(
        'reward',
        [
          this.keyPrefix,
          JSON.stringify({
            key,
            points,
            options
          })
        ],
        res => workerProcessResponse.call(this, res, resolve, reject)
      )
    })
  }

  block(key, secDuration, options = {}) {
    return new Promise<RateLimiterRes>((resolve, reject) => {
      this.ipcClient.send(
        'block',
        [
          this.keyPrefix,
          JSON.stringify({
            key,
            secDuration,
            options
          })
        ],
        res => workerProcessResponse.call(this, res, resolve, reject)
      )
    })
  }

  get(key, options = {}) {
    return new Promise<RateLimiterRes>((resolve, reject) => {
      this.ipcClient.send(
        'get',
        [
          this.keyPrefix,
          JSON.stringify({
            key,
            options
          })
        ],
        res => workerProcessResponse.call(this, res, resolve, reject)
      )
    })
  }

  delete(key, options = {}) {
    return new Promise<boolean>((resolve, reject) => {
      this.ipcClient.send(
        'delete',
        [
          this.keyPrefix,
          JSON.stringify({
            key,
            options
          })
        ],
        res => workerProcessResponse.call(this, res, resolve, reject)
      )
    })
  }
}

export class RateLimiterIPCMaster {
  // tslint:disable-next-line: variable-name
  _rateLimiters: Record<string, RateLimiterMemory>
  ipcServer: IPCServer

  constructor() {
    if (masterInstance) {
      return masterInstance
    }

    this.ipcServer = new IPCServer(channel)

    this._rateLimiters = {}

    this.ipcServer.on('init', ([keyPrefix, dataStr], ack) => {
      const existing = this._rateLimiters[keyPrefix]
      const opts = JSON.parse(dataStr)
      if (existing) {
        if (opts.points) {
          // @ts-ignore
          existing.points = opts.points
        }
        if (opts.duration) {
          // @ts-ignore
          existing.duration = opts.duration
        }
      } else {
        this._rateLimiters[keyPrefix] = new RateLimiterMemory(opts)
      }
      ack([])
    })

    this.ipcServer.on('consume', async ([keyPrefix, dataStr], ack) => {
      const data = JSON.parse(dataStr)
      try {
        const res = await this._rateLimiters[keyPrefix].consume(
          data.key,
          data.pointsToConsume,
          data.opts
        )
        ack({
          channel,
          keyPrefix,
          data: res,
          type: 'resolve'
        })
      } catch (err) {
        ack({
          channel,
          keyPrefix,
          data: err,
          type: 'reject'
        })
      }
    })

    this.ipcServer.on('penalty', async ([keyPrefix, dataStr], ack) => {
      const data = JSON.parse(dataStr)
      try {
        const res = await this._rateLimiters[keyPrefix].penalty(
          data.key,
          data.points,
          data.opts
        )
        ack({
          channel,
          keyPrefix,
          data: res,
          type: 'resolve'
        })
      } catch (err) {
        ack({
          channel,
          keyPrefix,
          data: err,
          type: 'reject'
        })
      }
    })

    this.ipcServer.on('reward', async ([keyPrefix, dataStr], ack) => {
      const data = JSON.parse(dataStr)
      try {
        const res = await this._rateLimiters[keyPrefix].reward(
          data.key,
          data.points,
          data.opts
        )
        ack({
          channel,
          keyPrefix,
          data: res,
          type: 'resolve'
        })
      } catch (err) {
        ack({
          channel,
          keyPrefix,
          data: err,
          type: 'reject'
        })
      }
    })

    this.ipcServer.on('block', async ([keyPrefix, dataStr], ack) => {
      const data = JSON.parse(dataStr)
      try {
        const res = await this._rateLimiters[keyPrefix].block(
          data.key,
          data.secDuration,
          data.opts
        )
        ack({
          channel,
          keyPrefix,
          data: res,
          type: 'resolve'
        })
      } catch (err) {
        ack({
          channel,
          keyPrefix,
          data: err,
          type: 'reject'
        })
      }
    })

    this.ipcServer.on('get', async ([keyPrefix, dataStr], ack) => {
      const data = JSON.parse(dataStr)
      try {
        const res = await this._rateLimiters[keyPrefix].get(data.key, data.opts)
        ack({
          channel,
          keyPrefix,
          data: res,
          type: 'resolve'
        })
      } catch (err) {
        ack({
          channel,
          keyPrefix,
          data: err,
          type: 'reject'
        })
      }
    })

    this.ipcServer.on('delete', async ([keyPrefix, dataStr], ack) => {
      const data = JSON.parse(dataStr)
      try {
        const res = await this._rateLimiters[keyPrefix].delete(
          data.key,
          data.opts
        )
        ack({
          channel,
          keyPrefix,
          data: res,
          type: 'resolve'
        })
      } catch (err) {
        ack({
          channel,
          keyPrefix,
          data: err,
          type: 'reject'
        })
      }
    })

    masterInstance = this
  }
}
