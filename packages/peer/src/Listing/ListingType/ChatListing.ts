import * as R from 'ramda';
import { query } from '@notabug/gun-scope';
import { ListingSpecType } from '../../types';
import { Config } from '../../Config';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';
import { TopicListing } from './TopicListing';

const path = '/t/:topic/chat';
const tabs = [...TopicListing.tabs, 'chat'];

const getSource = query<string>((scope, { topic, sort }) => {
  const normalTopics = Path.splitTopics(topic);
  const submitTo = topic === 'all' ? 'whatever' : normalTopics[0] || 'whatever';
  const topics = R.reduce((res, topic) => [...res, `chat:${topic}`], [] as string[], normalTopics);
  return ListingSpec.getSource(
    scope,
    Config.indexer,
    'listing:chat',
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

const getSpec = query<ListingSpecType>((scope, match) =>
  getSource(scope, match).then(source => ListingSpec.fromSource(source))
);

export const ChatListing = Path.withRoute({
  path,
  getSource,
  getSpec
});
