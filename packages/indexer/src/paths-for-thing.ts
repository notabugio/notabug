import { ThingMetaRecord } from './types'

export function pathsForThing(meta: ThingMetaRecord): string[] {
  // tslint:disable-next-line: readonly-array
  const listings: string[] = []

  const {
    isCommand,
    authorId,
    opId,
    replyToId,
    replyToAuthorId,
    replyToKind,
    kind,
    topic,
    domain,
    counts: { commands }
  } = meta

  if (kind === 'submission') {
    const taggedBy: any[] = []

    for (const key in commands) {
      if (key !== 'anon') {
        taggedBy.push(key)
      }
    }

    if (topic) {
      listings.push(`/t/${topic}`)
    }

    if (topic !== 'all') {
      const dotIdx = topic.indexOf('.')

      if (dotIdx === -1 || dotIdx === 0) {
        listings.push('/t/all')
      } else {
        const source = topic.slice(0, dotIdx)

        if (source !== 'test') {
          listings.push('/t/external.all')
        }

        listings.push(`/t/${source}.all`)
      }
    }

    if (domain) {
      listings.push(`/domain/${domain}`)
    }

    if (authorId) {
      listings.push(`/user/${authorId}/submitted`)
      listings.push(`/user/${authorId}/overview`)
    }

    taggedBy.forEach(tagAuthorId =>
      listings.push(`/user/${tagAuthorId}/commented`)
    )
  } else if (kind === 'comment') {
    if (opId) {
      listings.push(`/things/${opId}/comments`)
    }

    if (topic) {
      listings.push(`/t/comments:${topic}`)
    }

    if (topic !== 'all') {
      const dotIdx = topic.indexOf('.')

      if (dotIdx === -1 || dotIdx === 0) {
        listings.push('/t/comments:all')
      } else {
        const source = topic.slice(0, dotIdx)

        if (source !== 'test') {
          listings.push('/t/comments:external.all')
        }

        listings.push(`/t/comments:${source}.all`)
      }
    }

    if (replyToId) {
      if (replyToAuthorId) {
        listings.push(`/user/${replyToAuthorId}/replies/overview`)

        if (replyToKind === 'submission') {
          listings.push(`/user/${replyToAuthorId}/replies/submitted`)
        } else if (replyToKind === 'comment') {
          listings.push(`/user/${replyToAuthorId}/replies/comments`)
        }
      }
    }

    if (authorId) {
      listings.push(`/user/${authorId}/comments`)
      listings.push(`/user/${authorId}/overview`)

      if (isCommand) {
        listings.push(`/user/${authorId}/commands`)
      }

      // TODO: update commented
    }
  } else if (kind === 'chatmsg') {
    if (topic) {
      listings.push(`/t/chat:${topic}`)
    }

    if (topic !== 'all') {
      const dotIdx = topic.indexOf('.')

      if (dotIdx === -1 || dotIdx === 0) {
        listings.push('/t/chat:all')
      } else {
        const source = topic.slice(0, dotIdx)

        if (source !== 'test') {
          listings.push('/t/chat:external.all')
        }
        listings.push(`/t/chat:${source}.all`)
      }
    }
  }

  return listings
}
