import {
  FederatedAdapterOpts,
  FederationAdapter
} from '@chaingun/federation-adapter'
import { createGraphAdapter as createHttpAdapter } from '@chaingun/http-adapter'
import { GunGraphAdapter } from '@chaingun/sea-client'

export function createFederationAdapter(
  internal: GunGraphAdapter,
  peerUrls: readonly string[],
  persist?: GunGraphAdapter,
  opts?: FederatedAdapterOpts
): GunGraphAdapter {
  const peers: Record<string, GunGraphAdapter> = peerUrls.reduce((pm, url) => {
    return {
      ...pm,
      [url]: createHttpAdapter(`${url}/gun`)
    }
  }, {})
  const adapter = FederationAdapter.create(internal, peers, persist, opts)

  return adapter
}
