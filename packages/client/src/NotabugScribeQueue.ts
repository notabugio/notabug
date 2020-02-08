// tslint:disable: no-class no-expression-statement no-this
// tslint:disable: no-if-statement
import {
  /* GunGraphData, */ GunNode,
  GunProcessQueue
} from '@chaingun/sea-client'
import { LinguaWebcaClient } from '@lingua-webca/core'
import { Config, ThingDataNode } from '@notabug/peer'
// import { NotabugClient } from './NotabugClient'

export class NotabugScribeQueue extends GunProcessQueue<string> {
  protected readonly indexer: string
  protected readonly host: string
  protected readonly webca: LinguaWebcaClient
  protected readonly listingQueue: GunProcessQueue<string>
  // tslint:disable-next-line: readonly-keyword
  protected copiedCount: number
  // protected readonly nabClient: NotabugClient

  constructor(
    // nabClient: NotabugClient,
    webca: LinguaWebcaClient,
    indexer?: string,
    host?: string,
    name = 'NotabugScribeQueue'
  ) {
    super(name, 'dont_process_dupes')
    this.listingQueue = new GunProcessQueue<string>(
      'NotabugScribeQueue.listingQueue',
      'dont_process_dupes'
    )
    this.copiedCount = 0
    this.webca = webca
    // this.nabClient = nabClient
    this.indexer = indexer || Config.indexer
    this.host = host || 'notabug.io'
    this.middleware.use(this.copyThing.bind(this))
    this.listingQueue.middleware.use(this.copyListing.bind(this))
  }

  public async copyListing(path: string): Promise<string> {
    const { ids } = await this.webca.get(
      `notabug://${this.indexer}@${this.host}${path}/mirror`
    )
    this.enqueueMany(ids)
    this.process()
    console.log('fetched listing', path)

    return path
  }

  public enqueueListing(path: string): void {
    this.listingQueue.enqueue(path)
    this.listingQueue.process()
  }

  public async copyThing(thingId: string): Promise<string> {
    const { ids, /*nodes, */ thing, data } = await this.webca.get<{
      readonly ids: readonly string[]
      readonly nodes: readonly GunNode[]
      readonly thing: GunNode
      readonly data: GunNode
    }>(`notabug://${this.indexer}@${this.host}/things/${thingId}/mirror`)

    /*
    if (nodes.length) {
      const graph: GunGraphData = nodes.reduce((g, node) => {
        return {
          ...g,
          [node && node._ && node._['#']]: node
        }
      }, {})

      console.log('writing nodes', Object.keys(graph))
    }
    */

    const topicSoul = (thing && thing.topic && thing.topic['#']) || ''
    const topic = topicSoul.split('/').pop()
    const domain = ThingDataNode.domain(data)
    const authorId = ThingDataNode.authorId(data)

    if (topic) {
      this.enqueueListing(`/t/${topic}`)
    }

    if (domain) {
      this.enqueueListing(`/domain/${domain}`)
    }

    if (authorId) {
      this.enqueueListing(`/user/${authorId}`)
    }

    this.enqueueMany(ids)
    this.process()

    console.log(
      'fetched',
      thingId,
      this.copiedCount++,
      this.count(),
      this.listingQueue.count()
    )
    return thingId
  }
}
