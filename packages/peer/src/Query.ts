import * as R from 'ramda';
import { scope as makeScope, query, all, resolve } from '@chaingun/scope';
import { Config } from './Config';
import { Schema } from './Schema';
import { ListingNode } from './Listing/ListingNode';
import {
  CombinedThingType,
  ThingNode,
  GunScope,
  GunNodeType,
  ThingDataNodeType,
  ThingDataMap
} from './types';
import { ThingDataNode } from './Thing';

const thing = query<CombinedThingType | null>((scope, thingSoul) =>
  scope.get(thingSoul).then((meta: ThingNode) => {
    if (!meta || !meta.id) return null;
    const result: CombinedThingType = {
      id: meta.id,
      timestamp: parseFloat(meta.timestamp as string)
    };
    const replyToSoul: string = R.pathOr('', ['replyTo', '#'], meta);
    const opSoul: string = R.pathOr('', ['op', '#'], meta);
    const opId: string = R.propOr('', 'thingId', opSoul && Schema.Thing.route.match(opSoul));
    const replyToId: string = R.propOr(
      '',
      'thingId',
      replyToSoul && Schema.Thing.route.match(replyToSoul)
    );

    if (opId) result.opId = opId;
    if (replyToId) result.replyToId = replyToId;
    return result;
  })
);

const thingDataFromSouls = R.curry((scope: GunScope, souls: string[] | null) => {
  const ids = ListingNode.soulsToIds(souls || []);

  return all<[string, ThingDataNodeType][]>(
    R.map(id => thingData(scope, id).then(data => [id, data]), ids)
  ).then((pairs: [string, ThingDataNodeType][]) =>
    pairs.reduce((res, [id, data]) => R.assoc(id, data, res), {} as ThingDataMap)
  );
});

const thingScores = query((scope, thingId, tabulator = '') => {
  if (!thingId) return resolve(null);
  return scope
    .get(
      Schema.ThingVoteCounts.route.reverse({
        thingId,
        tabulator: tabulator || Config.tabulator
      })
    )
    .then();
}, 'thingScores');

const thingData = query<ThingDataNodeType | null>((scope, thingId) => {
  return thingId ? scope.get(Schema.Thing.route.reverse({ thingId })).get('data') : resolve(null);
}, 'thingData');

const thingMeta = query<CombinedThingType | null>(
  (scope, { thingSoul, tabulator, data = false, scores = false }) => {
    if (!thingSoul) return resolve(null);
    const id = ListingNode.soulToId(thingSoul);

    return all<[CombinedThingType, GunNodeType, GunNodeType]>([
      thing(scope, thingSoul),
      scores ? thingScores(scope, id, tabulator) : resolve(null),
      data ? thingData(scope, id) : resolve(null)
    ]).then(([meta, votes, data]) => {
      if (!meta || !meta.id) return null;
      return { ...meta, votes, data };
    });
  }
);

const multiThingMeta = query((scope, params) =>
  all(
    R.reduce(
      (promises, thingSoul) => {
        if (!thingSoul) return promises;
        promises.push(thingMeta(scope, { ...params, thingSoul }));
        return promises;
      },
      [] as PromiseLike<CombinedThingType | null>[],
      R.propOr([], 'thingSouls', params)
    )
  )
);

const userPages = query(
  (scope, authorId) => scope.get(Schema.AuthorPages.route.reverse({ authorId })),
  'userPages'
);

const wikiPageId = query((scope, authorId, name) => {
  if (!authorId || !name) return resolve(null);

  return scope
    .get(Schema.AuthorPages.route.reverse({ authorId }))
    .get(name)
    .get('id');
}, 'wikiPageId');

const wikiPage = query<ThingDataNodeType | null>((scope, authorId, name) =>
  wikiPageId(scope, authorId, name).then(id => id && thingData(scope, id))
);

const userMeta = query((scope, id) => {
  if (!id) return resolve(null);
  return scope.get(`~${id}`).then((meta: GunNodeType) => ({
    alias: R.prop('alias', meta),
    createdAt: R.path(['_', '>', 'pub'], meta)
  }));
}, 'userMeta');

const createScope = R.curry((nab, opts) => makeScope({ gun: nab.gun, ...(opts || {}) }));

export const Query = {
  thingMeta,
  multiThingMeta,
  thingScores,
  thingData,
  thingDataFromSouls,
  userPages,
  wikiPageId,
  wikiPage,
  userMeta,
  createScope
};
