// tslint:disable: no-var-requires
require('dotenv').config()
import { ChainGunLinguaStore } from '@lingua-webca/chaingun'
import { HttpStore, PathPrefixedStore, store, webca } from '@lingua-webca/core'
import { NotabugLinguaStore } from '@notabug/client'
import { SaiditIngestStore } from './SaiditIngestStore'

store.use('https://', HttpStore.store)
store.use('http://', HttpStore.store)
store.use('gun://', ChainGunLinguaStore.create())
store.use('notabug://', NotabugLinguaStore.create(webca))
store.use(
  'ingest://saidit',
  PathPrefixedStore.create('ingest://saidit', SaiditIngestStore.create(webca))
)

if (!process.env.SAIDIT_INGEST_GUN_ALIAS) {
  throw new Error('Missing ingest username')
}

if (!process.env.SAIDIT_INGEST_GUN_PASSWORD) {
  throw new Error('Missing ingest password')
}

const MIN_INTERVAL =
  parseInt(process.env.SAIDIT_INGEST_MIN_INTERVAL || '', 10) * 1000 || 60 * 1000

webca
  .post('notabug://notabug.io/login', {
    alias: process.env.SAIDIT_INGEST_GUN_ALIAS,
    password: process.env.SAIDIT_INGEST_GUN_PASSWORD
  })
  .then(async () => {
    // tslint:disable-next-line: no-let
    let lastPoll = 0

    function fetchNext(): Promise<any> {
      return new Promise((ok, fail) => {
        setTimeout(async () => {
          lastPoll = new Date().getTime()
          await webca.patch(
            `notabug://notabug.io/me/pages/config:saidit_ingest/yaml`,
            {
              running: true
            }
          )
          webca
            .post(`ingest://saidit/things/t5/new`, {})
            .then((res: any) => {
              // tslint:disable-next-line: no-console
              console.log(res)
              ok(res)
            })
            .catch(fail)
        }, MIN_INTERVAL - (new Date().getTime() - lastPoll))
      })
    }

    try {
      while (true) {
        try {
          await fetchNext()
        } catch (e) {
          // tslint:disable-next-line: no-console
          console.error(e.stack)
          await webca.patch(
            `notabug://notabug.io/me/pages/config:saidit_ingest/yaml`,
            {
              running: false
            }
          )
        }
      }
    } finally {
      await webca.patch(
        `notabug://notabug.io/me/pages/config:saidit_ingest/yaml`,
        {
          running: false
        }
      )
    }
  })
