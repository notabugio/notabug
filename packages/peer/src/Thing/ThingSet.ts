import * as R from 'ramda';
import { Schema } from '../Schema';
import { GunNode } from '../GunNode';
import { GunNodeType } from '../types';

const souls = GunNode.edges;
const ids = R.compose(
  R.filter(R.identity as (i: any) => boolean) as (i: string[]) => string[],
  R.map<any, string>(
    R.compose(
      R.prop('thingId') as (i: any) => string,
      Schema.Thing.route.match.bind(Schema.Thing.route)
    )
  ),
  GunNode.edges
);

const union = R.compose(R.dissoc('_'), R.reduce(R.mergeRight, {} as GunNodeType)) as (
  nodes: GunNodeType[]
) => GunNodeType;

function dayStr(timestamp: number | null | undefined) {
  const d = new Date(timestamp || new Date().getTime());
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const dayNum = d.getUTCDate();

  return `${year}/${month}/${dayNum}`;
}

export const ThingSet = { ids, union, souls, dayStr };
