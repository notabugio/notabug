import * as R from 'ramda';
import { all, resolve } from '@notabug/gun-scope';
import { Constants } from '../Constants';
import { Schema } from '../Schema';
import { Query } from '../Query';
import { ThingDataNode } from '../Thing';
import { ListingNode } from './ListingNode';
import { ListingDataSource } from './ListingDataSource';
import {
  ListingDefinitionType,
  ListingNodeRow,
  GunScope,
  ListingSpecType,
  CombinedThingType
} from '../types';

const intPath = (p: string[]) => R.compose(parseInt, R.pathOr('', p));

type FilterFunction = (thing: CombinedThingType) => boolean;

const fromDefinition = (definition: ListingDefinitionType) => {
  const { filters, voteFilters, isPresent } = definition;
  const filterFunctions: FilterFunction[] = [];
  const voteFilterFunctions: FilterFunction[] = [];
  const addFilter = (...fns: Function[]) =>
    filterFunctions.push(R.compose(...(fns as [FilterFunction])));

  const addSubmissionFilter = (...fns: Function[]) =>
    addFilter(
      R.cond([
        [R.pathEq(['data', 'kind'], 'submission'), R.compose(...(fns as [FilterFunction]))],
        [R.T, R.T]
      ])
    );
  const addVoteFilter = (...fns: Function[]) =>
    voteFilterFunctions.push(R.compose(...(fns as [FilterFunction])));

  if (filters.allow.aliases.length) {
    addFilter((t: string) => !!isPresent(['alias', t]), R.path(['data', 'author']));
  }
  if (filters.allow.authors.length) {
    addFilter((t: string) => !!isPresent(['author', t]), R.path(['data', 'authorId']));
  }
  if (filters.allow.domains.length) {
    addSubmissionFilter(
      (t: string) => !!isPresent(['domain', t]),
      ThingDataNode.domain,
      R.prop('data')
    );
  }

  if (
    filters.allow.topics.length &&
    !R.find(
      R.compose(
        R.identical('all'),
        R.last as (strs: string[]) => string,
        R.split('.'),
        R.last as (strs: string[]) => string,
        R.split(':')
      ),
      filters.allow.topics as string[]
    )
  ) {
    addFilter((item: CombinedThingType) => {
      const dataNode = R.prop('data', item);
      let topic = ThingDataNode.topic(dataNode).toLowerCase();
      const kind = R.pathOr('' as string, ['data', 'kind'], item);

      if (kind === 'chatmsg') topic = `chat:${topic}`;
      if (kind === 'comment') topic = `comments:${topic}`;
      return !!isPresent(['topic', topic]);
    });
  }

  if (filters.allow.kinds.length) {
    addFilter((kind: string) => !!isPresent(['kind', kind]), R.path(['data', 'kind']));
  }

  if (filters.allow.type === 'commands') {
    addFilter(R.compose(R.test(Constants.COMMAND_RE), R.pathOr('', ['data', 'body'])));
  }

  if (isPresent('ban type commands')) {
    addFilter(
      R.compose(R.complement(R.test(Constants.COMMAND_RE)), R.pathOr('', ['data', 'body']))
    );
  }

  if (filters.deny.aliases.length) {
    addFilter((alias: string) => !isPresent(['ban', 'alias', alias]), R.path(['data', 'author']));
  }
  if (filters.deny.authors.length) {
    addFilter(
      (authorId: string) => !isPresent(['ban', 'author', authorId]),
      R.path(['data', 'authorId'])
    );
  }
  if (filters.deny.domains.length) {
    addSubmissionFilter(
      (domain: string) => !domain || !isPresent(['ban', 'domain', domain]),
      ThingDataNode.domain,
      R.prop('data')
    );
  }
  if (filters.deny.topics.length) {
    addFilter(
      (topic: string) => !isPresent(['ban', 'topic', topic]),
      R.toLower,
      ThingDataNode.topic,
      R.prop('data')
    );
  }

  if (filters.deny.anon) {
    if (voteFilters.upsMin !== null) {
      addVoteFilter(
        R.anyPass([
          R.compose((id: any) => !!id, R.path(['data', 'authorId'])),
          R.compose(votes => votes >= voteFilters.upsMin, intPath(['votes', 'up']))
        ])
      );
    } else {
      addFilter(R.path(['data', 'authorId']));
    }
  } else {
    if (voteFilters.upsMin !== null) {
      addVoteFilter(R.lte(voteFilters.upsMin), intPath(['votes', 'up']));
    }
    if (voteFilters.upsMax !== null) {
      addVoteFilter(R.gte(voteFilters.upsMax), intPath(['votes', 'up']));
    }
    if (voteFilters.downsMin !== null) {
      addVoteFilter(R.lte(voteFilters.downsMin), intPath(['votes', 'down']));
    }
    if (voteFilters.downsMax !== null) {
      addVoteFilter(R.gte(voteFilters.downsMax), intPath(['votes', 'down']));
    }
    if (voteFilters.scoreMin !== null) {
      addVoteFilter(R.lte(voteFilters.scoreMin), intPath(['votes', 'score']));
    }
    if (voteFilters.scoreMax !== null) {
      addVoteFilter(R.gte(voteFilters.scoreMax), intPath(['votes', 'score']));
    }
  }

  if (filters.deny.signed) {
    addFilter(R.compose(authorId => !authorId, R.pathOr('', ['data', 'authorId'])));
  }

  if (filters.deny.selfposts) {
    addFilter(
      R.complement(
        R.allPass([
          R.compose(x => !x, ThingDataNode.url),
          R.compose(R.identical('submission'), ThingDataNode.kind)
        ])
      ),
      R.prop('data')
    );
  }

  if (filters.deny.tags.length) {
    addVoteFilter((thing: CombinedThingType) => {
      const cmds = R.path(['votes', 'commands'], thing) || {};

      return !filters.deny.tags.find(
        ([tagName, authorId]: [string, string]) => !!R.path([authorId, 'tag', tagName], cmds)
      );
    });
  }

  const contentFilter = (thing: CombinedThingType) => !filterFunctions.find(fn => !fn(thing));
  const voteFilter = (thing: CombinedThingType) => !voteFilterFunctions.find(fn => !fn(thing));
  const thingFilter = (thing: CombinedThingType) =>
    definition.isIdSticky(R.propOr('', 'id', thing)) || (contentFilter(thing) && voteFilter(thing));
  return { thingFilter, contentFilter, voteFilter };
};

type FilterFnType = (id: string) => Promise<boolean>;

interface GetRowsParams {
  limit?: string;
  count?: string;
  after?: string;
  filterFn: FilterFnType;
}

const getFilteredRows = (
  scope: GunScope,
  spec: ListingSpecType,
  sortedRows: ListingNodeRow[],
  params?: GetRowsParams
): Promise<ListingNodeRow[]> => {
  const {
    limit: limitProp = '25',
    count: countProp = '0',
    after = null,
    filterFn = R.always(resolve(true))
  } = params || {};
  const limit = parseInt(limitProp, 10);
  const count = parseInt(countProp, 10) || 0;
  const rows = sortedRows.slice();
  const filtered: ListingNodeRow[] = [];
  const data: any[] = [];
  const fetchBatch = (size = 30) =>
    all(
      R.map(row => {
        if (!row[ListingNode.POS_ID]) {
          console.log('blankRow', row);
          return resolve(null);
        }

        return (filterFn
          ? filterFn((row[ListingNode.POS_ID] as string) || '')
          : resolve(true)
        ).then((inListing: boolean) => {
          if (!inListing) return;
          if (spec.uniqueByContent) {
            return Query.thingData(scope, row[ListingNode.POS_ID]).then(itemData => {
              const url = ThingDataNode.url(itemData);
              if (url && R.find(R.compose(R.equals(url), ThingDataNode.url), data)) {
                return;
              }
              data.push(itemData);
              filtered.push(row);
            });
          }
          filtered.push(row);
        });
      }, rows.splice(count, size))
    );

  const fetchNextBatch = (): Promise<ListingNodeRow[]> => {
    if (filtered.length > limit || rows.length <= count) {
      return resolve(
        R.compose(
          limit
            ? (R.slice(0, limit) as (rows: ListingNodeRow[]) => ListingNodeRow[])
            : (R.identity as (rows: ListingNodeRow[]) => ListingNodeRow[]),
          R.uniqBy(R.nth(ListingNode.POS_ID)),
          R.sortBy(R.nth(ListingNode.POS_VAL) as (row: ListingNodeRow) => number) as (
            row: ListingNodeRow[]
          ) => ListingNodeRow[],
          R.always(filtered) as () => ListingNodeRow[]
        )()
      );
    }

    return fetchBatch().then(fetchNextBatch);
  };
  return fetchNextBatch();
};

const getFilteredIds: (
  scope: GunScope,
  spec: ListingSpecType,
  sortedRows: ListingNodeRow[],
  params?: GetRowsParams
) => Promise<string[]> = R.compose(
  x => x.then(R.map(R.nth(ListingNode.POS_ID) as (row: ListingNodeRow) => string)),
  getFilteredRows
);

const thingFilter = R.curry(
  (scope, spec, thingId): Promise<boolean> => {
    if (spec.isIdSticky(thingId)) return resolve(true);

    return Query.thingMeta(scope, {
      tabulator: spec.tabulator,
      thingSoul: Schema.Thing.route.reverse({ thingId }),
      scores: ListingDataSource.needsScores(spec),
      data: ListingDataSource.needsData(spec)
    }).then(spec.thingFilter);
  }
);

export const ListingFilter = {
  fromDefinition,
  getFilteredRows,
  getFilteredIds,
  thingFilter
};
