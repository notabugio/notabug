import { GunGraphData, unpackNode } from '@chaingun/sea-client'
import { CommentCommand, Schema, Thing, ThingDataNode } from '@notabug/peer'
import { mergeDeepLeft } from 'ramda'
import { TabulatorChanges, TabulatorThingChanges } from './types'

export function describeDiff(diff: GunGraphData): TabulatorChanges | null {
  const changes: TabulatorChanges = {}

  for (const soul in diff) {
    if (!soul) {
      continue
    }

    const votesUpMatch = Schema.ThingVotesUp.route.match(soul)

    if (votesUpMatch) {
      const { _, ...votes } = diff[soul]
      const upsCount = Object.keys(votes).length
      const { thingId } = votesUpMatch
      const thingChanges: TabulatorThingChanges =
        changes[thingId] || (changes[thingId] = {})
      thingChanges.up = (thingChanges.up || 0) + upsCount
      thingChanges.score = (thingChanges.up || 0) + upsCount

      continue
    }

    const votesDownMatch = Schema.ThingVotesDown.route.match(soul)

    if (votesDownMatch) {
      const { _, ...votes } = diff[soul]
      const downsCount = Object.keys(votes).length
      const { thingId } = votesDownMatch
      const thingChanges: TabulatorThingChanges =
        changes[thingId] || (changes[thingId] = {})
      thingChanges.down = (thingChanges.down || 0) + downsCount
      thingChanges.score = (thingChanges.score || 0) - downsCount

      continue
    }

    const thingDataMatch =
      Schema.ThingData.route.match(soul) ||
      Schema.ThingDataSigned.route.match(soul)

    if (thingDataMatch) {
      const { thingId } = thingDataMatch
      const thingData = unpackNode(diff[soul])
      const { replyToId } = thingData

      if (replyToId && ThingDataNode.isCommand(thingData)) {
        const commandMap = CommentCommand.map(({
          [thingId]: thingData
        } as unknown) as any)
        const parentThingChanges: TabulatorThingChanges =
          changes[replyToId] || (changes[replyToId] = {})
        parentThingChanges.commandMap = mergeDeepLeft(
          commandMap,
          parentThingChanges.commandMap || {}
        )
      }

      continue
    }

    const thingMatch = Schema.Thing.route.match(soul)

    if (thingMatch) {
      const { thingId } = thingMatch
      const thing = diff[soul] // thing diffs can't be partial
      if (!thing) {
        continue
      }
      const { timestamp } = thing

      const opId = Thing.opId(thing)
      const replyToId = Thing.replyToId(thing)

      const thingChanges: TabulatorThingChanges =
        changes[thingId] || (changes[thingId] = {})

      thingChanges.created = timestamp

      if (timestamp > thingChanges.updated) {
        thingChanges.updated = timestamp
      }

      if (opId) {
        const opThingChanges: TabulatorThingChanges =
          changes[opId] || (changes[opId] = {})
        opThingChanges.comment = (opThingChanges.comment || 0) + 1
        if (timestamp > opThingChanges.updated) {
          opThingChanges.updated = timestamp
        }
      }

      if (replyToId) {
        const parentThingChanges: TabulatorThingChanges =
          changes[replyToId] || (changes[replyToId] = {})
        parentThingChanges.replies = (parentThingChanges.replies || 0) + 1
      }

      continue
    }
  }

  return Object.keys(changes).length ? changes : null
}
