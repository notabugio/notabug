import { ChainGunLinguaStore } from '@lingua-webca/chaingun'
import { HttpStore, store, webca } from '@lingua-webca/core'
import { NotabugLinguaStore } from './Lingua'
// import { NotabugScribeQueue } from './NotabugScribeQueue'

// This is a WIP test/demo of lingua-webca  does not do anything useful yet

store.use('https://', HttpStore.store)
store.use('http://', HttpStore.store)
store.use('gun://', ChainGunLinguaStore.create())
store.use('notabug://', NotabugLinguaStore.create(webca))
