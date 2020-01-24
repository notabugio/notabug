import * as R from 'ramda';
import { query, resolve, all } from '@notabug/gun-scope';
import { Constants } from '../Constants';
import { Config } from '../Config';
import { Schema } from '../Schema';
import { ListingNodeRow, ListingNodeType, SortDataRow, GunScope } from '../types';

const [POS_IDX, POS_ID, POS_VAL] = [0, 1, 2, 3];

const rowsToIds = (rows: ListingNodeRow[]) =>
  rows.map(row => ((row && row[POS_ID]) || '') as string).filter(id => !!id);
const rowsToItems = R.map<ListingNodeRow, SortDataRow>(
  (R.slice(1, 3) as unknown) as (row: ListingNodeRow) => SortDataRow
);
const source = R.propOr('', 'source');
const soulFromPath = R.curry((indexer, path) => `${Constants.PREFIX}${path}@~${indexer}.`);
const pathFromSoul = R.compose(
  R.replace(new RegExp(`^${Constants.PREFIX}`), ''),
  R.replace(/@~.*\./, '')
);

const idToSoul = (thingId: string) => Schema.Thing.route.reverse({ thingId }) || '';
const idsToSouls = (ids: string[]) => ids.map(idToSoul).filter(id => !!id);
const soulToId = (soul: string) => R.propOr('', 'thingId', Schema.Thing.route.match(soul));
const soulsToIds = R.map(soulToId);

function getRow(node: ListingNodeType, idx: string | number) {
  const row: (string | number)[] = R.split(',', R.propOr('', `${idx}`, node));
  row[0] = ((row[0] as string) || '').trim();
  row[1] = parseFloat(row[1] as string);
  row.splice(0, 0, parseInt(idx as string, 10));
  return row as ListingNodeRow;
}

const itemKeys = R.compose(
  R.filter(
    R.compose(
      val => !!(val === 0 || val),
      (val: string) => parseInt(val, 10)
    )
  ) as (keys: string[]) => string[],
  R.keysIn as (node: ListingNodeType) => string[]
);

function rows(node: ListingNodeType): ListingNodeRow[] {
  const keys = R.sortBy(key => -1 * node._[key], R.keysIn(node._['>']));
  const result: ListingNodeRow[] = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyVal = parseInt(key, 10);
    if (!keyVal && keyVal !== 0) continue;
    result.push(getRow(node, key));
  }

  return R.uniqBy(R.nth(0), result);
}

const ids = R.compose(rowsToIds, rows);

const sortRows = R.sortWith([
  R.ascend(
    R.compose(
      R.cond([
        [R.isNil, R.always(Infinity)],
        [R.T, parseFloat]
      ]),
      R.nth(POS_VAL) as any
    )
  )
]) as (rows: ListingNodeRow[]) => ListingNodeRow[];

const sortedIds = R.compose(
  R.map(R.nth(POS_ID) as (row: ListingNodeRow) => string | undefined),
  sortRows,
  R.filter(R.identity as (T: ListingNodeRow) => boolean) as (
    rows: ListingNodeRow[]
  ) => ListingNodeRow[],
  rows
);

const mapSortData = (R.addIndex(R.map) as unknown) as (
  fn: (r: SortDataRow, i: number) => ListingNodeRow
) => (data: SortDataRow[]) => ListingNodeRow[];
const itemsToRows = mapSortData(
  (item: SortDataRow, idx: number): ListingNodeRow => [idx, item[0], item[1]]
);

async function diffSingle(
  node: ListingNodeType,
  updatedItem: SortDataRow,
  { maxSize = 1000 } = {}
) {
  let highestIndex = -1;
  let highestValueKey = '';
  let highestValue: Number | null = null;
  let key: string;
  const [updateId, updateValue] = updatedItem;

  for (key in node || {}) {
    const parsed = parseInt(key, 10);

    if (!(parsed || parsed === 0)) continue;

    const row: ListingNodeRow = getRow(node, key);
    const [idx, id = null, value] = row;
    if (id === updateId) {
      if (updateValue === value) return null;
      return { [key]: updatedItem.join(',') };
    }

    if (!highestValueKey || highestValue === null || (value && value > highestValue)) {
      highestValue = value;
      highestValueKey = key;
    }
    if (idx !== null && idx > highestIndex) highestIndex = idx;
  }

  if (!maxSize || highestIndex + 1 < maxSize) {
    return { [`${highestIndex + 1}`]: updatedItem.join(',') };
  }

  if (highestValueKey && (highestValue === null || updateValue < highestValue)) {
    return { [highestValueKey]: updatedItem.join(',') };
  }

  return null;
}

async function diff(
  node: ListingNodeType,
  updatedItems: SortDataRow[] = [],
  removeIds: string[] = [],
  { maxSize = 1000 } = {}
) {
  if (updatedItems.length === 1 && !removeIds.length) {
    return diffSingle(node, updatedItems[0], { maxSize });
  }
  console.log('diff multi', updatedItems);
  const removed = R.indexBy(R.identity, removeIds);
  const byId = {} as { [id: string]: ListingNodeRow };
  const changes: ListingNodeType = {};
  const rows: ListingNodeRow[] = [];
  const updated = {} as { [id: string]: boolean };
  let toReplace = [];
  let maxIdx = 0;
  let key;

  for (key in node || {}) {
    const parsed = parseInt(key, 10);

    if (!(parsed || parsed === 0)) continue;
    const row: ListingNodeRow = getRow(node, key);
    const [idx, id = null, rawValue = null] = row;
    row[POS_VAL] = rawValue === null ? null : rawValue;
    if (id && removed[id]) row[POS_ID] = row[POS_VAL] = null;
    if (id) byId[id] = row;
    if (row[POS_ID]) {
      rows.push(row);
    } else {
      toReplace.push(row);
    }
    if (idx && idx > maxIdx) maxIdx = idx;
  }

  for (let i = 0; i < updatedItems.length; i++) {
    const [id, value] = updatedItems[i] || [null, null];

    if (!id) continue;
    const existing = byId[id];

    if (existing) {
      if (existing[POS_VAL] !== value) {
        existing[POS_VAL] = value;
        updated[id] = true;
      }
    } else {
      const row: ListingNodeRow = [null, id, value];

      rows.push(row);
    }
  }

  const allSorted = sortRows(rows);
  const sorted = maxSize ? allSorted.slice(0, maxSize) : allSorted;
  const missing = maxSize ? allSorted.slice(maxSize, allSorted.length) : [];
  const added = R.filter(row => row[POS_IDX] === null, sorted);

  toReplace.push(...R.filter(row => row[POS_IDX] !== null, missing));
  toReplace.reverse();

  for (let i = 0; i < sorted.length; i++) {
    const id = sorted[i][POS_ID];
    const idx = sorted[i][POS_IDX];
    const val = sorted[i][POS_VAL];

    if (idx !== null && updated[id || '']) changes[`${idx}`] = [id, val].join(',');
  }

  const inserted = [];

  while (added.length) {
    const row = added.pop();
    const replaced = toReplace.pop();
    let [idx] = replaced || [null];

    if (idx === null) {
      idx = maxIdx + inserted.length + 1;
      inserted.push(idx);
    }

    if (row) changes[`${idx}`] = [row[POS_ID], row[POS_VAL]].join(',');
  }

  while (toReplace.length) {
    const row = toReplace.pop();

    if (row && !row[POS_ID]) {
      const idx = `${row[POS_IDX]}`;

      if (node[idx] !== null) {
        changes[idx] = null;
        console.log('nulling', idx, node[idx]);
      }
    }
  }

  return R.keys(changes).length ? changes : null;
}

const unionRows = R.compose(
  R.uniqBy(R.nth(POS_ID)),
  sortRows,
  R.reduce((res: ListingNodeRow[], rows: ListingNodeRow[]) => {
    res.push(...rows);
    return res;
  }, [] as ListingNodeRow[]),
  R.map(rows)
) as (input: any) => ListingNodeRow[];

const rowsFromSouls = query<ListingNodeRow[]>((scope: GunScope, souls: string[]) =>
  all(R.map(scope.get, souls)).then(unionRows)
);

const read = query((scope: GunScope, path: string, opts: { indexer?: string }) => {
  const { indexer = Config.indexer } = opts || {};

  return rowsFromSouls(scope, [soulFromPath(indexer, path)]).then(rowsToIds);
}, 'listingRows');

const get = query(
  (scope: GunScope, soul: string) => (soul ? scope.get(soul).then() : resolve(null)),
  'listing'
);

export const ListingNode = {
  POS_IDX,
  POS_ID,
  POS_VAL,
  source,
  get,
  getRow,
  itemKeys,
  rows,
  ids,
  idToSoul,
  idsToSouls,
  soulToId,
  soulsToIds,
  rowsToIds,
  rowsToItems,
  itemsToRows,
  sortRows,
  sortedIds,
  soulFromPath,
  pathFromSoul,
  rowsFromSouls,
  read,
  diff,
  unionRows
};
