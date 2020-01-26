import * as R from 'ramda';
import { query } from '@chaingun/scope';
import { Config } from '../../Config';
import { Path } from '../Path';
import { ListingSpec } from '../ListingSpec';

const path = '/domain/:domain/:sort';
const tabs = ['hot', 'new', 'active', 'discussed', 'controversial', 'top'];

const getSource = query<string>((scope, { domain, sort }) => {
  const domains = Path.splitTopics(domain);

  return ListingSpec.getSource(
    scope,
    Config.indexer,
    'listing:domain',
    [
      `name ${domains[0]}`,
      'submit to whatever',
      `sort ${sort}`,
      'kind submission',
      ...R.map(domain => `domain ${domain}`, domains),
      ...R.map(tab => `tab ${tab} /domain/${domain}/${tab}`, tabs)
    ].join('\n')
  );
});

const getSpec = query((scope, match) => getSource(scope, match).then(ListingSpec.fromSource));

export const DomainListing = Path.withRoute({
  path,
  tabs,
  getSource,
  getSpec
});
