import * as R from 'ramda';
import { ListingDefinitionType } from '../types';

const needsScores = (definition: ListingDefinitionType) =>
  !!R.find(definition.isPresent, [
    'sort hot',
    'sort top',
    'sort best',
    'sort controversial',
    'ups',
    'downs',
    'score',
    'can remove'
  ]);

const needsData = (definition: ListingDefinitionType) =>
  !!R.find(definition.isPresent, [
    'topic',
    'domain',
    'author',
    'unique by content',
    'kind',
    'type',
    'require signed',
    'require anon',
    'alias',
    'ban domain',
    'ban topic',
    'ban author',
    'ban alias',
    'ban type'
  ]);

const listingSource = (definition: ListingDefinitionType) => {
  const listings = R.pathOr([], ['filters', 'allow', 'listings'], definition);
  const { sort } = definition;
  const listingPaths = R.map(l => `${l}/${sort}`, listings);

  return { listingPaths };
};

const topicSource = (definition: ListingDefinitionType) => {
  const { sort } = definition;
  const topics = R.pathOr([] as string[], ['filters', 'allow', 'topics'], definition);

  if (!topics.length) topics.push('all');
  const listingPaths = R.map(t => `/t/${t}/${sort}`, topics);

  return { listingPaths };
};

const domainSource = (definition: ListingDefinitionType) => {
  const { sort } = definition;
  const domains = R.pathOr([], ['filters', 'allow', 'domains'], definition);

  if (!domains.length) return topicSource(definition);
  const listingPaths = R.map(d => `/domain/${d}/${sort}`, domains);

  return { listingPaths };
};

const authorSource = (definition: ListingDefinitionType) => {
  const { sort } = definition;
  const authorIds = R.pathOr([], ['filters', 'allow', 'authors'], definition);
  const type = R.path(['filters', 'allow', 'type'], definition) || 'overview';

  if (!authorIds.length) return topicSource(definition);
  const listingPaths = R.map(id => `/user/${id}/${type}/${sort}`, authorIds);

  return { listingPaths };
};

const curatorSource = (definition: ListingDefinitionType) => {
  const { sort } = definition;
  const curators = R.prop('curators', definition) || [];

  if (!curators.length) return topicSource(definition);
  const listingPaths = R.map(id => `/user/${id}/commented/${sort}`, curators);

  return { listingPaths };
};

const opSource = (definition: ListingDefinitionType) => {
  const { sort } = definition;
  const submissionIds = R.pathOr([], ['filters', 'allow', 'ops'], definition);

  if (!submissionIds.length) topicSource(definition);
  const listingPaths = R.map(id => `/things/${id}/comments/${sort}`, submissionIds);

  return { listingPaths };
};

const repliesSource = (definition: ListingDefinitionType) => {
  const { sort } = definition;
  const id = R.path(['filters', 'allow', 'repliesTo'], definition);
  const type = R.path(['filters', 'allow', 'type'], definition);

  const listingPaths = [`/user/${id}/replies/${type}/${sort}`];

  return { listingPaths };
};

const sources = {
  op: opSource,
  listing: listingSource,
  replies: repliesSource,
  curator: curatorSource,
  author: authorSource,
  domain: domainSource,
  topic: topicSource
};

const sourceNames = R.keys(sources);
const sourceName = (def: ListingDefinitionType) => R.find(def.isPresent, sourceNames) || 'topic';
const fromDefinition = (definition: ListingDefinitionType) => {
  const name = sourceName(definition);

  return R.mergeLeft({ name }, sources[name](definition));
};

export const ListingDataSource = {
  fromDefinition,
  sources,
  needsScores,
  needsData
};
