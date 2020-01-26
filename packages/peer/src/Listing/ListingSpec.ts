import * as R from 'ramda';
import { query } from '@chaingun/scope';
import { Query } from '../Query';
import { ThingDataNode } from '../Thing';
import { ListingDefinition } from './ListingDefinition';
import { ListingDataSource } from './ListingDataSource';
import { ListingFilter } from './ListingFilter';
import { ListingSpecType, ListingDefinitionType } from '../types';

const fromSource = R.compose(
  R.apply(R.mergeLeft) as (l: any) => ListingSpecType,
  R.juxt([ListingFilter.fromDefinition, R.identity]),
  R.apply(R.assoc('dataSource')) as (l: any) => ListingDefinitionType,
  R.juxt([ListingDataSource.fromDefinition, R.identity]),
  ListingDefinition.fromSource
) as (source: string, ownerId?: string, spaceName?: string) => ListingSpecType;

const getSource = query<string>((scope, authorId, name, extra = '') =>
  Query.wikiPage(scope, authorId, name).then(
    R.compose(
      body => `${body}
# added by indexer
${extra || ''}
sourced from page ${authorId} ${name}
`,
      ThingDataNode.body
    )
  )
);

export const ListingSpec = { fromSource, getSource };
