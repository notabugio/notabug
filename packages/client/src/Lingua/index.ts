import { createSpecificNabStore } from './API'
import { createNabStore } from './metaStore'

export const NotabugLinguaStore = {
  create: createNabStore,
  createSpecific: createSpecificNabStore
}
