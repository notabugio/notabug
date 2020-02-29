import * as R from 'ramda';
import objHash from 'object-hash';
import { Schema } from '../Schema';
import { ThingNode } from '../types';

export { ThingSet } from './ThingSet';
export { ThingDataNode } from './ThingDataNode';

const soulToId = R.compose(
  R.propOr('', 'thingId'),
  Schema.Thing.route.match.bind(Schema.Thing.route)
);

const soulsToIds = R.map(soulToId);

const index = R.curry((peer, thingId, data) => {
  if (!data.topic && !data.opId) return;
  const thing = peer.gun.get(Schema.Thing.route.reverse({ thingId }));

  if (data.opId) {
    const allcomments = peer.gun.get(Schema.ThingAllComments.route.reverse({ thingId: data.opId }));

    allcomments.set(thing);
  }

  if (data.replyToId) {
    const comments = peer.gun.get(Schema.ThingComments.route.reverse({ thingId: data.replyToId }));

    comments.set(thing);
  }
});

const put = R.curry((peer, data) => {
  data.timestamp = data.timestamp || new Date().getTime(); // eslint-disable-line
  const originalHash = objHash(data);
  const { timestamp, kind, topic, authorId, opId, replyToId } = data;
  const thingId = objHash({
    timestamp,
    kind,
    topic,
    authorId,
    opId,
    replyToId,
    originalHash
  });

  const node = peer.gun.get(Schema.Thing.route.reverse({ thingId }));
  const dataSoul = authorId
    ? Schema.ThingDataSigned.route.reverse({ thingId, authorId })
    : Schema.ThingData.route.reverse({ thingId: originalHash });

  const metaData: ThingNode = {
    id: thingId,
    timestamp,
    kind,
    originalHash,
    data: {
      _: {
        '#': dataSoul,
        '>': Object.keys(data).reduce((res, key) => {
          res[key] = data.timestamp;
          return res;
        }, {} as { [key: string]: number })
      },
      ...data
    },
    votesup: { '#': Schema.ThingVotesUp.route.reverse({ thingId }) as string },
    votesdown: {
      '#': Schema.ThingVotesDown.route.reverse({ thingId }) as string
    },
    allcomments: {
      '#': Schema.ThingAllComments.route.reverse({ thingId }) as string
    },
    comments: { '#': Schema.ThingComments.route.reverse({ thingId }) as string }
  };

  if (topic) {
    metaData.topic = {
      '#': Schema.Topic.route.reverse({ topicName: topic }) as string
    };
  }
  if (authorId) metaData.author = { '#': `~${authorId}` };
  if (opId) {
    metaData.op = {
      '#': Schema.Thing.route.reverse({ thingId: opId }) as string
    };
  }
  if (replyToId) {
    metaData.replyTo = {
      '#': Schema.Thing.route.reverse({ thingId: replyToId }) as string
    };
  }

  node.put(metaData);
  index(peer, thingId, data);
  return node;
});

const submit = R.curry((peer, data) => {
  const timestamp = data.timestamp || new Date().getTime();
  const user = peer.isLoggedIn();

  if (data.topic) data.topic = data.topic.toLowerCase().trim(); // eslint-disable-line
  if (data.domain) data.domain = data.domain.toLowerCase().trim(); // eslint-disable-line
  if (user) {
    data.author = user.alias; // eslint-disable-line
    data.authorId = user.pub; // eslint-disable-line
  }

  const thing = put(peer, { ...data, timestamp, kind: 'submission' });

  return thing;
});

const comment = R.curry((peer, data) => {
  const user = peer.isLoggedIn();

  if (data.topic) data.topic = data.topic.toLowerCase().trim(); // eslint-disable-line
  if (user) {
    data.author = user.alias; // eslint-disable-line
    data.authorId = user.pub; // eslint-disable-line
  }

  const thing = put(peer, { ...data, kind: 'comment' });

  return thing;
});

const chat = R.curry((peer, data) => {
  const user = peer.isLoggedIn();

  if (data.topic) data.topic = data.topic.toLowerCase().trim(); // eslint-disable-line
  if (user) {
    data.author = user.alias; // eslint-disable-line
    data.authorId = user.pub; // eslint-disable-line
  }

  const thing = put(peer, { ...data, kind: 'chatmsg' });

  return thing;
});

const writePage = R.curry((peer, name, body) => {
  const user = peer.isLoggedIn();

  if (!user) return Promise.reject('not logged in');
  let thing;
  const pagesSoul = Schema.AuthorPages.route.reverse({ authorId: user.pub });
  const chain = peer.gun.get(pagesSoul).get(name);

  return chain.then((res: ThingNode) => {
    if (res && res.data) {
      chain
        .get('data')
        .get('body')
        .put(body);
    } else {
      const data = {
        body,
        title: name,
        kind: 'wikipage',
        author: user.alias,
        authorId: user.pub
      };

      thing = put(peer, data);
      chain.put(thing);
    }
  });
});

const vote = R.curry((peer, id, kind, nonce) => {
  const votes = peer.gun.get(
    Schema[kind === 'up' ? 'ThingVotesUp' : 'ThingVotesDown'].route.reverse({
      thingId: id
    })
  );

  return votes.put({ [nonce]: '1' });
});

function replyToId(thingNode: any) {
  const soul = thingNode?.replyTo?.['#'];

  if (!soul) {
    return;
  }

  const match = Schema.Thing.route.match(soul);

  if (!match) {
    return;
  }

  return match.thingId;
}

function opId(thingNode: any) {
  const soul = thingNode?.op?.['#'];

  if (!soul) {
    return;
  }

  const match = Schema.Thing.route.match(soul);

  if (!match) {
    return;
  }

  return match.thingId;
}

function authorId(thingNode: any) {
  const soul = thingNode?.author?.['#'];

  if (!soul) {
    return;
  }

  const match = Schema.SEAAuthor.route.match(soul);

  if (!match) {
    return;
  }

  return match.authorId;
}

function topic(thingNode: any) {
  const soul = thingNode?.topic?.['#'];

  if (!soul) {
    return;
  }

  const match = Schema.Topic.route.match(soul);

  if (!match) {
    return;
  }

  return match.topicName;
}

function kind(thingNode: any) {
  return thingNode?.kind;
}

export const Thing = {
  soulToId,
  soulsToIds,
  put,
  submit,
  comment,
  chat,
  writePage,
  vote,
  index,
  replyToId,
  opId,
  authorId,
  kind,
  topic
};
