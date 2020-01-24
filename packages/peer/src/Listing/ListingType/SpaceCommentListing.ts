import { query } from '@notabug/gun-scope';
import { Path } from '../Path';
import { SpaceSpec } from '../SpaceSpec';
import { ListingSpec } from '../ListingSpec';

const path = '/user/:authorId/spaces/:name/comments/:thingId/:sort';

const getSource = query<string>((scope, { thingId, authorId, name, sort }) =>
  SpaceSpec.getSource(scope, authorId, name, [`op ${thingId}`, `sort ${sort}`].join('\n'))
);

const getSpec = query((scope, { thingId, authorId, name, sort }) =>
  SpaceSpec.getSpec(scope, authorId, name, [`op ${thingId}`, `sort ${sort}`].join('\n'))
);

export const SpaceCommentListing = Path.withRoute({
  path,
  getSource,
  getSpec
});
