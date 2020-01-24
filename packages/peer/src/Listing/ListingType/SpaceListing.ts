import { query } from '@notabug/gun-scope';
import { Path } from '../Path';
import { SpaceSpec } from '../SpaceSpec';

const path = '/user/:authorId/spaces/:name/:sort';

const getSource = query<string>((scope, { authorId, name, sort }) =>
  SpaceSpec.getSource(scope, authorId, name, `sort ${sort}`)
);

const getSpec = query((scope, { authorId, name, sort }) =>
  SpaceSpec.getSpec(scope, authorId, name, `sort ${sort}`)
);

export const SpaceListing = Path.withRoute({
  path,
  getSource,
  getSpec
});
