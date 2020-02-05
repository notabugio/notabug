import {
  ChainGunSeaClient,
  GunGraph,
  GunGraphAdapter,
  GunGraphConnectorFromAdapter,
  GunNode,
  pubFromSoul,
  unpackNode
} from '@chaingun/sea-client'
import { Query } from '@notabug/peer'
import { NotabugWorker } from './worker'

export class NotabugClient extends ChainGunSeaClient {
  public readonly worker: NotabugWorker
  protected readonly adapter: GunGraphAdapter

  constructor(worker: NotabugWorker) {
    const graph = new GunGraph()

    super({ graph })

    this.adapter = this.setupAdapter(worker)
    const dbConnector = new GunGraphConnectorFromAdapter(this.adapter)
    this.worker = worker
    this.readNode = this.readNode.bind(this)

    dbConnector.sendRequestsFromGraph(graph as any)
    dbConnector.sendPutsFromGraph(graph as any)
    graph.connect(dbConnector)
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

  public readNode(soul: string): Promise<GunNode | null> {
    return new Promise<GunNode | null>((ok, fail) => {
      const timeout = setTimeout(() => fail(new Error('Read timeout')), 60000)

      function done(val: any): void {
        clearTimeout(timeout)
        ok(val)
      }

      // tslint:disable-next-line: no-unused-expression
      this.adapter.get(soul).then(node => {
        if (pubFromSoul(soul)) {
          unpackNode(node, 'mutable')
        }

        done(node)
      })
    })
  }

  public newScope(): any {
    return Query.createScope(
      { gun: this },
      {
        getter: this.readNode,
        unsub: true
      }
    )
  }

  protected setupAdapter(worker: NotabugWorker): GunGraphAdapter {
    return worker.adapter
  }
}
