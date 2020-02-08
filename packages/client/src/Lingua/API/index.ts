import {
  ExpressLikeStore,
  LinguaWebcaClient,
  LinguaWebcaStore,
  webca as universe
} from '@lingua-webca/core'
import { contentApi } from './content'
import { mirrorApi } from './mirror'
import { nodeApi } from './nodes'
import { submitApi } from './submit'

interface LoggedInAs {
  readonly pub: string
  readonly alias: string
}

// This is a WIP, this API will change!
export function createSpecificNabStore(
  indexer: string,
  host: string,
  webca: LinguaWebcaClient = universe
): LinguaWebcaStore {
  const app = new ExpressLikeStore()
  let user: LoggedInAs | null = null

  app.post('/logout', async (req, res) => {
    const response = await webca.post(`gun://${host}/logout`, req.body)

    if (response.code === 200) {
      user = null
    }

    res.json(response)
  })

  app.post('/login', async (req, res) => {
    const response = await webca.post(`gun://${host}/login`, req.body)
    if (!response) {
      throw new Error('Login Error')
    } else {
      user = { pub: response.pub, alias: response.alias }
      res.json(response)
    }
  })

  app.get(`/me/*rest`, async (req, res) => {
    const { rest } = req.params
    if (!user) {
      throw new Error('Not logged in')
    } else {
      res.json(await app.client.get(`/content/user/${user.pub}/${rest}`))
    }
  })

  app.patch(`/me/*rest`, async (req, res) => {
    const { rest } = req.params
    if (!user) {
      throw new Error('Not logged in')
    } else {
      res.json(
        await app.client.patch(`/content/user/${user.pub}/${rest}`, req.body)
      )
    }
  })

  app.post(`/me/*rest`, async (req, res) => {
    const { rest } = req.params
    if (!user) {
      throw new Error('Not logged in')
    } else {
      res.json(
        await app.client.post(`/content/user/${user.pub}/${rest}`, req.body)
      )
    }
  })

  app.put(`/me/*rest`, async (req, res) => {
    const { rest } = req.params
    if (!user) {
      throw new Error('Not logged in')
    } else {
      res.json(
        await app.client.put(`/content/user/${user.pub}/${rest}`, req.body)
      )
    }
  })

  nodeApi(app, indexer, host, webca)
  mirrorApi(app, indexer, host, webca)
  contentApi(app, indexer, host, webca)
  submitApi(app, host, webca)

  return app.request
}
