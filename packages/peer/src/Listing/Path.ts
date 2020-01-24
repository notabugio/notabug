import * as R from 'ramda';
import Route from 'route-parser';

const splitDomains = R.compose(
  R.sortBy(R.identity) as (i: any[]) => string[],
  R.filter(R.identity as (i: any) => boolean),
  R.map(R.trim),
  R.split('+'),
  R.toLower,
  R.defaultTo('') as (i: string | undefined) => string
);

const splitTopics = R.compose(
  R.ifElse(R.prop('length'), R.identity, R.always(['all'])),
  splitDomains
) as (topic: string) => string[];

const withRoute = (obj: any) => R.assoc('route', new Route(obj.path), obj);

export const Path = { splitDomains, splitTopics, withRoute };
