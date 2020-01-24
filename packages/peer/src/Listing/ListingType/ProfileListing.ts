import * as R from 'ramda';
import { query } from '@notabug/gun-scope';
import { ListingSpecType } from '../../types';
import { Config } from '../../Config';
import { Query } from '../../Query';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';

const path = '/user/:authorId/:type/:sort';
const tabs = ['overview', 'comments', 'submitted', 'commands'];

const getSource = query<string>((scope, { authorId, type, sort }) =>
  ListingSpec.getSource(
    scope,
    Config.indexer,
    'listing:profile',
    [
      `author ${authorId}`,
      `type ${type}`,
      `sort ${sort}`,
      ...R.map(tab => `tab ${tab} /user/${authorId}/${tab}`, tabs)
    ].join('\n')
  )
);

const getSpec = query((scope, match) =>
  Query.userMeta(scope, match.authorId).then(meta =>
    getSource(scope, match).then(
      (R.pipe(
        ListingSpec.fromSource,
        R.mergeLeft({
          profileId: match.authorId,
          displayName: R.propOr('', 'alias', meta)
        })
      ) as unknown) as (source: string) => ListingSpecType
    )
  )
);

export const ProfileListing = Path.withRoute({
  path,
  tabs,
  getSource,
  getSpec
});
