import {
  LinguaWebcaClient,
  LinguaWebcaStore,
  PathPrefixedStore,
  SwitchingStore,
  webca as universe
} from '@lingua-webca/core'
import { Config } from '@notabug/peer'
import { parse as uriParse } from 'uri-js'
import { createSpecificNabStore } from './API'

export function createNabStore(
  webca: LinguaWebcaClient = universe
): LinguaWebcaStore {
  const storeCache: Record<string, LinguaWebcaStore> = {}

  return SwitchingStore.create(request => {
    const { scheme, host, port, userinfo } = uriParse(request.uri)
    const indexer = userinfo || Config.indexer

    // tslint:disable-next-line: no-if-statement
    if (scheme !== 'notabug') {
      return () =>
        Promise.resolve({
          body: `Invalid notabug uri scheme ${scheme}`,
          code: 500,
          request,
          uri: request.uri
        })
    }

    // tslint:disable-next-line: no-if-statement
    if (!host) {
      return () =>
        Promise.resolve({
          body: `Invalid notabug uri host`,
          code: 500,
          request,
          uri: request.uri
        })
    }

    const basePath = `${scheme}://${userinfo ? `${userinfo}@` : ''}${host}${
      port ? `:${port}` : ''
    }`
    const store = (storeCache[basePath] =
      storeCache[basePath] ||
      PathPrefixedStore.create(
        basePath,
        createSpecificNabStore(indexer, host, webca)
      ))

    return store
  })
}
