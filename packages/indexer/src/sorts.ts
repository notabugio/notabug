import { ThingMetaRecord, ThingMetaSortScores } from './types'

const sorts = {
  new(record: ThingMetaRecord): number {
    const ts = Math.min(record.created, new Date().getTime())
    return ts * -1
  },

  top(record: ThingMetaRecord): number {
    const score = record.counts.up - record.counts.down
    return -1 * score
  },

  active(record: ThingMetaRecord): number {
    const ts = Math.min(record.updated, new Date().getTime())
    return ts * -1
  },

  discussed(record: ThingMetaRecord): number {
    const ts = Math.min(record.created, new Date().getTime())
    const score = record.counts.comment
    const seconds = ts / 1000 - 1134028003
    const order = Math.log10(Math.max(Math.abs(score), 1))

    if (!score) {
      return 1000000000 - seconds
    }

    return -1 * (order + seconds / 45000)
  },

  hot(record: ThingMetaRecord): number {
    const timestamp = Math.min(record.created, new Date().getTime())
    const score = record.counts.up - record.counts.down
    const seconds = timestamp / 1000 - 1134028003
    const order = Math.log10(Math.max(Math.abs(score), 1))
    let sign = 0

    if (score > 0) {
      sign = 1
    } else if (score < 0) {
      sign = -1
    }
    return -1 * (sign * order + seconds / 45000)
  },

  best(record: ThingMetaRecord): number {
    const { up: ups, down: downs } = record.counts
    const n = ups + downs

    if (n === 0) {
      return 0
    }
    const z = 1.281551565545 // 80% confidence
    const p = ups / n
    const left = p + (1 / (2 * n)) * z * z
    const right = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
    const under = 1 + (1 / n) * z * z

    return -1 * ((left - right) / under)
  },

  controversial(record: ThingMetaRecord): number {
    const { up: ups, down: downs } = record.counts

    if (ups <= 0 || downs <= 0) {
      return 0
    }
    const magnitude = ups + downs
    const balance = ups > downs ? downs / ups : ups / downs

    return -1 * magnitude ** balance
  }
}

export function calculateSortScores(
  record: ThingMetaRecord
): ThingMetaSortScores {
  const scores: ThingMetaSortScores = {}

  for (const sortName in sorts) {
    if (!sortName) {
      continue
    }

    scores[sortName] = sorts[sortName](record)
  }

  return scores
}
