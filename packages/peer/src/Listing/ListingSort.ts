import * as R from 'ramda';
import { query, resolve } from '@chaingun/scope';
import { Schema } from '../Schema';
import { Query } from '../Query';
import { SortDataRow, CombinedThingType } from '../types';

const [POS_ID, POS_VAL] = [0, 1];
const toIds = R.map(R.nth(POS_ID));
const sortItems = R.sortBy(R.nth(POS_VAL) as (row: SortDataRow) => number);

const voteSort = (fn: (thing: CombinedThingType | null) => number) =>
  query<number>((scope, thingId, spec) => {
    if (spec.isIdSticky(thingId)) return resolve(-Infinity);
    if (R.includes(thingId, spec.filters.allow.ops)) return resolve(-Infinity);

    return Query.thingMeta(scope, {
      tabulator: spec.tabulator,
      scores: true,
      thingSoul: Schema.Thing.route.reverse({ thingId })
    }).then(fn);
  });

const timeSort = (fn: (thing: CombinedThingType | null) => number) =>
  query<number>((scope, thingId, spec) =>
    Query.thingMeta(scope, {
      tabulator: spec.tabulator,
      thingSoul: Schema.Thing.route.reverse({ thingId })
    }).then(fn)
  );

const sorts = {
  new: timeSort(
    R.compose(
      R.multiply(-1),
      ts => Math.min(ts, new Date().getTime()),
      parseInt,
      R.propOr(0, 'timestamp')
    )
  ),
  top: voteSort(R.compose((x: string) => -1 * parseInt(x, 10), R.pathOr('0', ['votes', 'score']))),
  active: voteSort(thing => {
    const thingTimestamp = parseInt(R.propOr('', 'timestamp', thing), 10);
    const commentsTimestamp = parseInt(R.pathOr('0', ['votes', '_', '>', 'comment'], thing), 10);
    return -1 * (commentsTimestamp || thingTimestamp);
  }),
  discussed: voteSort(thing => {
    const timestamp = parseInt(R.propOr('', 'timestamp', thing), 10);
    const score = parseInt(R.pathOr('0', ['votes', 'comment'], thing), 10);
    const seconds = timestamp / 1000 - 1134028003;
    const order = Math.log10(Math.max(Math.abs(score), 1));

    if (!score) return 1000000000 - seconds;
    return -1 * (order + seconds / 45000);
  }),
  hot: voteSort(thing => {
    const timestamp = parseInt(R.propOr('', 'timestamp', thing), 10);
    const score = parseInt(R.pathOr('0', ['votes', 'score'], thing), 10);
    const seconds = timestamp / 1000 - 1134028003;
    const order = Math.log10(Math.max(Math.abs(score), 1));
    let sign = 0;

    if (score > 0) {
      sign = 1;
    } else if (score < 0) {
      sign = -1;
    }
    return -1 * (sign * order + seconds / 45000);
  }),
  best: voteSort(thing => {
    const ups = parseInt(R.pathOr('0', ['votes', 'up'], thing), 10);
    const downs = parseInt(R.pathOr('0', ['votes', 'down'], thing), 10);
    const n = ups + downs;

    if (n === 0) return 0;
    const z = 1.281551565545; // 80% confidence
    const p = ups / n;
    const left = p + (1 / (2 * n)) * z * z;
    const right = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    const under = 1 + (1 / n) * z * z;

    return -1 * ((left - right) / under);
  }),
  controversial: voteSort(thing => {
    const ups = parseInt(R.pathOr('0', ['votes', 'up'], thing), 10);
    const downs = parseInt(R.pathOr('0', ['votes', 'down'], thing), 10);

    if (ups <= 0 || downs <= 0) return 0;
    const magnitude = ups + downs;
    const balance = ups > downs ? downs / ups : ups / downs;

    return -1 * magnitude ** balance;
  })
};

const isValidSort = (sort: string) => !!(sort in sorts);

export const ListingSort = {
  POS_ID,
  POS_VAL,
  sorts,
  isValidSort,
  toIds,
  sortItems
};
