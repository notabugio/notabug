import { GunProcessQueue } from '@notabug/chaingun'
import { sign } from '@notabug/gun-sear'
import Gun from 'gun'
import socketCluster from 'socketcluster-client'
import { Validation } from './Validation'

const DEFAULT_OPTS = {
  socketCluster: {
    autoReconnect: true,
    hostname: process.env.GUN_SC_HOST || 'localhost',
    port: parseInt(process.env.GUN_SC_PORT, 10) || 4444
  }
}

export class NabWireValidator {
  public readonly use: (x: any) => any | null
  public readonly unuse: (x: any) => any | null
  protected readonly suppressor: any
  protected readonly socket: any
  protected readonly validationQueue: GunProcessQueue

  constructor(options = DEFAULT_OPTS) {
    this.suppressor = Validation.createSuppressor(Gun)
    this.socket = socketCluster.create(options.socketCluster)
    this.socket.on('connect', this.onConnected.bind(this))
    this.socket.on('error', err => {
      // tslint:disable-next-line: no-console
      console.error('SC Connection Error', err.stack, err)
    })

    this.validationQueue = new GunProcessQueue()
    this.validationQueue.completed.on(this.onReceivePut.bind(this))

    this.use = this.validationQueue.middleware.use
    this.unuse = this.validationQueue.middleware.unuse

    setInterval(
      () => this.authenticate(),
      1000*60*30
    )
  }

  public authenticateAs(pub: string, priv: string): Promise<void> {
    const id = this.socket!.id
    const timestamp = new Date().getTime()
    const challenge = `${id}/${timestamp}`

    return sign(challenge, { pub, priv }, { raw: true }).then(proof =>
      new Promise((ok, fail) => {
        this.socket!.emit(
          'login',
          {
            proof,
            pub
          },
          (err: any) => (err ? fail(err) : ok())
        )
      }).then(() => {
        // tslint:disable-next-line: no-console
        console.log('socket id', this.socket.id)
      })
    )
  }

  public validateGets(): void {
    const channel = this.socket.subscribe('gun/get', { waitForAuth: true })
    channel.on('subscribe', () => {
      channel.watch(this.onReceiveGet.bind(this))
    })
  }

  public validatePuts(): void {
    const channel = this.socket.subscribe('gun/put', { waitForAuth: true })
    channel.on('subscribe', () => {
      channel.watch(msg => {
        this.validationQueue.enqueue(msg)
        this.validationQueue.process()
      })
    })
  }

  protected onReceiveGet(msg: any): void {
    this.suppressor
      .validate(msg)
      .then(isValid => {
        if (isValid) {
          this.socket.publish('gun/get/validated', msg)
        } else {
          throw new Error('Invalid get')
        }
      })
      .catch(error =>
        // tslint:disable-next-line: no-console
        console.error('Error validating get', error.stack || error, msg)
      )
  }

  protected onReceivePut(msg: any): void {
    if (!msg) {
      return
    }
    this.suppressor
      .validate(msg)
      .then(isValid => {
        if (isValid) {
          this.socket.publish('gun/put/validated', msg)
        } else {
          throw new Error('Invalid put')
        }
      })
      .catch(error =>
        // tslint:disable-next-line: no-console
        console.error('Error validating put', error.stack || error, msg)
      )
  }

  protected authenticate() : void {
    if (process.env.GUN_SC_PUB && process.env.GUN_SC_PRIV) {
      this.authenticateAs(process.env.GUN_SC_PUB, process.env.GUN_SC_PRIV)
        // tslint:disable-next-line: no-console
        .then(() => console.log(`Logged in as ${process.env.GUN_SC_PUB}`))
        // tslint:disable-next-line: no-console
        .catch(err => console.error('Error logging in:', err.stack || err))
    } else {
      // tslint:disable-next-line: no-console
      console.error('Missing GUN_SC_PUB/GUN_SC_PRIV env variables')
      process.exit(1)
    }

  }


  protected onConnected(): void {
    this.authenticate()
  }
}
