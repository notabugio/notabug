import { query } from '@chaingun/scope';
import { Config } from '../../Config';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';

const path = '/user/:authorId/replies/:type/:sort';

const getSource = query<string>((scope, { authorId, type, sort = 'new' }) =>
  ListingSpec.getSource(
    scope,
    Config.indexer,
    'listing:inbox',
    [`replies to author ${authorId}`, 'kind comment', `type ${type}`, `sort ${sort}`].join('\n')
  )
);

const getSpec = query((scope, match) => getSource(scope, match).then(ListingSpec.fromSource));

export const InboxListing = Path.withRoute({
  path,
  getSource,
  getSpec
});
