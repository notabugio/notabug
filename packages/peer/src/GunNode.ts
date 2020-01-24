/* globals Gun */
import * as R from 'ramda';
import { GunNodeType } from './types';

declare const Gun: any;

const soul = R.pathOr('', ['_', '#']) as (node: GunNodeType) => string;
const state = R.pathOr({}, ['_', '>']) as (node: GunNodeType) => { [key: string]: number };

const latest = R.compose(
  R.last as (res: number[]) => number,
  R.sortBy(R.identity),
  R.values as (state: any) => number[],
  state
);

const edges = R.compose(R.map(R.propOr('', '#')), R.values as any);

const diff = (existing: GunNodeType, updated: GunNodeType) => {
  const changedKeys = R.without(['_'], R.keysIn(updated)).filter(k => {
    const newVal = updated[k];
    const oldVal = R.prop(k, existing);

    return !R.equals(newVal, oldVal) && `${newVal}` !== `${oldVal}`;
  });

  return R.pick(changedKeys, updated);
};

function decodeSEA(rawData: GunNodeType) {
  const data = rawData ? { ...rawData } : rawData;
  const soul = R.pathOr('' as string, ['_', '#'], data);

  if (!soul || !Gun.SEA || soul.indexOf('~') === -1) return rawData;
  R.without(['_'], R.keys(data)).forEach(key => {
    Gun.SEA.verify(
      Gun.SEA.opt.pack(rawData[key], key, rawData, soul),
      false,
      (res: any) => (data[key] = Gun.SEA.opt.unpack(res, key, rawData))
    );
  });
  return data;
}

export const GunNode = { soul, state, diff, latest, edges, decodeSEA };
