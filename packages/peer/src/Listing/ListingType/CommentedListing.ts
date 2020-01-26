import { query } from '@chaingun/scope';
import { Config } from '../../Config';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';

const path = '/user/:authorId/commented/:sort';

const getSource = query<string>((scope, { authorId, sort }) =>
  ListingSpec.getSource(
    scope,
    Config.indexer,
    'listing:commented',
    [`curator ${authorId}`, `sort ${sort}`].join('\n')
  )
);

const getSpec = query((scope, match) => getSource(scope, match).then(ListingSpec.fromSource));

export const CommentedListing = Path.withRoute({ path, getSource, getSpec });
