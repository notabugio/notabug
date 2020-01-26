import { query } from '@chaingun/scope';
import { Config } from '../../Config';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';

const path = '/things/:thingId/comments/:sort';

const getSource = query<string>((scope, { thingId, sort }) =>
  ListingSpec.getSource(
    scope,
    Config.indexer,
    'listing:comments',
    [`op ${thingId}`, `sort ${sort}`].join('\n')
  )
);

const getSpec = query((scope, match) => getSource(scope, match).then(ListingSpec.fromSource));

export const CommentListing = Path.withRoute({
  path,
  getSource,
  getSpec
});
