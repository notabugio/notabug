import * as R from 'ramda';
import { query } from '@chaingun/scope';
import { Config } from '../../Config';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';
import { TopicListing } from './TopicListing';

const path = '/t/:topic/firehose';
const tabs = TopicListing.tabs;

const getSource = query<string>((scope, { topic, sort }) => {
  const normalTopics = Path.splitTopics(topic);
  const submitTo = topic === 'all' ? 'whatever' : normalTopics[0] || 'whatever';
  const topics = normalTopics.reduce(
    (res, topic) => [...res, topic, `chat:${topic}`, `comments:${topic}`],
    [] as string[]
  );

  return ListingSpec.getSource(
    scope,
    Config.indexer,
    'listing:firehose',
    [
      'sort new',
      'display as chat',
      `submit to ${submitTo}`,
      `sort ${sort}`,
      ...R.map(topic => `topic ${topic}`, topics),
      ...R.map(tab => `tab ${tab} /t/${topic}/${tab}`, tabs)
    ].join('\n')
  );
});

const getSpec = query((scope, match) => getSource(scope, match).then(ListingSpec.fromSource));

export const FirehoseListing = Path.withRoute({
  tabs,
  path,
  getSource,
  getSpec
});
