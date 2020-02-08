import {
  ChainGunSeaClient,
  GunGraph,
  GunGraphAdapter,
  GunGraphConnector,
  GunGraphConnectorFromAdapter,
  pubFromSoul,
  unpackNode
} from '@chaingun/sea-client'
// tslint:disable-next-line: no-implicit-dependencies
import SocketClusterGraphConnector from '@chaingun/socketcluster-connector'
import { Query } from '@notabug/peer'
// tslint:disable-next-line: no-implicit-dependencies no-submodule-imports
import { SCServerOptions } from 'socketcluster-server/scserver'

const READ_TIMEOUT = 10000

interface Opts {
  readonly readTimeout?: number
  readonly socketCluster?: SCServerOptions
}

const DEFAULT_OPTS: Opts = {
  readTimeout: READ_TIMEOUT,
  socketCluster: {
    autoReconnect: true,
    hostname: process.env.GUN_SC_HOST || '127.0.0.1',
    path: process.env.GUN_SC_PATH || '/socketcluster',
    port: parseInt(process.env.GUN_SC_PORT || '', 10) || 4444,
    secure: process.env.GUN_SC_CONNECTION
      ? process.env.GUN_SC_CONNECTION === 'secure'
      : parseInt(process.env.GUN_SC_PORT || '', 10) === 443
  }
}

export class NotabugClient extends ChainGunSeaClient {
  public readonly socket: SocketClusterGraphConnector
  protected readonly dbAdapter?: GunGraphAdapter
  protected readonly dbConnector:
    | GunGraphConnector
    | SocketClusterGraphConnector
  protected readonly readTimeout: number

  constructor(dbAdapter?: GunGraphAdapter, options = DEFAULT_OPTS) {
    const { readTimeout, socketCluster: scOpts, ...opts } = {
      ...DEFAULT_OPTS,
      ...options
    }

    const graph = new GunGraph()
    const socket = new SocketClusterGraphConnector(options.socketCluster)
    const dbConnector = dbAdapter
      ? new GunGraphConnectorFromAdapter(dbAdapter)
      : socket

    dbConnector.sendRequestsFromGraph(graph as any)
    dbConnector.sendPutsFromGraph(graph as any)

    graph.connect(dbConnector as any)

    super({ graph, ...opts })
    this.directRead = this.directRead.bind(this)
    this.readTimeout = readTimeout || READ_TIMEOUT
    this.socket = socket
    this.dbAdapter = dbAdapter
    this.dbConnector = dbConnector
  }

  public newScope(): any {
    return Query.createScope(
      { gun: this },
      {
        getter: this.directRead,
        unsub: true
      }
    )
  }

  public authenticate(
    alias = process.env.GUN_ALIAS || '',
    password = process.env.GUN_PASSWORD || ''
  ): Promise<{
    readonly alias: string
    readonly pub: string
  }> {
    if (alias && password && !this.user().is) {
      return this.user().auth(alias, password)
    }

    return Promise.reject(new Error('Missing alias or password'))
  }

  protected directRead(soul: string): Promise<any> {
    return new Promise((ok, fail) => {
      const timeout = setTimeout(
        () => fail(new Error('Read timeout')),
        this.readTimeout
      )

      function done(val: any): void {
        clearTimeout(timeout)
        ok(val)
      }

      // tslint:disable-next-line: no-unused-expression
      this.dbAdapter &&
        this.dbAdapter.get(soul).then(node => {
          if (pubFromSoul(soul)) {
            unpackNode(node, 'mutable')
          }

          done(node)
        })
    })
  }
}
