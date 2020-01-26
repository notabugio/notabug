import * as R from 'ramda';
import { query } from '@chaingun/scope';
import { ListingSpecType, GunScope } from '../../types';
import { Config } from '../../Config';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';

const path = '/t/:topic/:sort';
const tabs = ['hot', 'new', 'active', 'discussed', 'controversial', 'top', 'firehose'];

const getSource = query<string>(
  (scope: GunScope, { topic, sort }: { topic: string; sort: string }) => {
    const topics = Path.splitTopics(topic);
    const submitTo = topics[0] === 'all' ? 'whatever' : topics[0];

    return ListingSpec.getSource(
      scope,
      Config.indexer,
      'listing:topic',
      [
        `name ${topic}`,
        `submit to ${submitTo}`,
        `sort ${sort}`,
        topic.indexOf(':') === -1 ? 'kind submission' : '',
        ...R.map(topic => `topic ${topic}`, topics),
        ...R.map(tab => `tab ${tab} /t/${topic}/${tab}`, tabs)
      ].join('\n')
    );
  }
);

const getSpec = query<ListingSpecType>((scope, match) =>
  getSource(scope, match).then(
    R.pipe(
      ListingSpec.fromSource as (source: string) => ListingSpecType,
      R.assoc('basePath', `/t/${match.topic}`)
    )
  )
);

export const TopicListing = Path.withRoute({
  tabs,
  path,
  getSource,
  getSpec
});
