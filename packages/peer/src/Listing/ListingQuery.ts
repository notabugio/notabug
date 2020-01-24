import * as R from 'ramda';
import memoize from 'fast-memoize';
import { resolve, all } from '@notabug/gun-scope';
import { Query } from '../Query';
import { ListingSpecType, ListingNodeRow, GunScope, ListingNodeType } from '../types';
import { ListingNode } from './ListingNode';
import { ListingFilter } from './ListingFilter';
import { ListingType } from './ListingType';
import { ListingSpec } from './ListingSpec';

export class ListingQuery {
  path: string;
  type: any;
  spec: ListingSpecType;
  rowsFromNode: (node: ListingNodeType) => ListingNodeRow[];
  combineSourceRows: (rowsSets: ListingNodeRow[][]) => ListingNodeRow[];
  viewCache: { [soul: string]: ListingQuery };
  listings: ListingQuery[];
  sourced: { [id: string]: ListingNodeRow };
  checked: { [id: string]: boolean };

  constructor(path: string, parent?: ListingQuery) {
    this.listings = [];
    this.viewCache = parent ? parent.viewCache : {};
    this.sourced = {};
    this.checked = {};
    this.path = path;
    this.type = ListingType.fromPath(path);
    if (!this.type) throw new Error(`Can't find type for path: ${path}`);
    this.spec = ListingSpec.fromSource('');
    this.rowsFromNode = parent ? parent.rowsFromNode : memoize(ListingNode.rows);
    this.combineSourceRows = parent
      ? parent.combineSourceRows
      : memoize(
          R.pipe(
            R.reduce(
              R.concat as (a: ListingNodeRow[], b: ListingNodeRow[]) => ListingNodeRow[],
              [] as ListingNodeRow[]
            ),
            ListingNode.sortRows,
            R.uniqBy(R.nth(ListingNode.POS_ID))
          )
        );
  }

  space(scope: GunScope) {
    return this.type.getSpec(scope, this.type.match).then((baseSpec: ListingSpecType) => {
      let spec = baseSpec;

      if (this.type.match.sort === 'default') {
        spec = R.assoc(
          'path',
          this.type.route.reverse(R.assoc('sort', spec.sort, this.type.match)),
          spec
        );
      } else {
        spec = R.assoc('path', this.path, baseSpec);
      }

      if (spec.submitTopic && !spec.submitPath) {
        spec = R.assoc('submitPath', `/t/${spec.submitTopic}/submit`, spec);
      }

      if (!R.equals(this.spec, spec)) {
        this.spec = spec;
        this.checked = {};
      }
      return this.spec;
    });
  }

  sidebar(scope: GunScope) {
    return this.space(scope).then((spec: ListingSpecType) => {
      const { fromPageAuthor = '', fromPageName = '' } = spec || {};
      const promises = [];
      if (spec.profileId) {
        promises.push(Query.wikiPage(scope, spec.profileId, 'profile'));
      }
      if (fromPageAuthor && fromPageName) {
        promises.push(Query.wikiPage(scope, fromPageAuthor, `${fromPageName}:sidebar`));
      }
      if (!promises.length) return;
      return Promise.all(promises);
    });
  }

  unfilteredRows(scope: GunScope): Promise<ListingNodeRow[]> {
    if (!this.type) return resolve([]);
    return this.space(scope)
      .then((spec: ListingSpecType) => {
        const paths = R.pathOr([], ['dataSource', 'listingPaths'], spec);
        const listingPaths = R.without([this.path], paths);
        this.listings = listingPaths.map(
          path => this.viewCache[path] || (this.viewCache[path] = new ListingQuery(path, this))
        );
        if (!this.listings.length) {
          return scope
            .get(ListingNode.soulFromPath(spec.indexer, this.path))
            .then(R.pipe(this.rowsFromNode, R.of, this.combineSourceRows));
        }
        return all<ListingNodeRow[]>(this.listings.map(l => l.unfilteredRows(scope))).then(
          this.combineSourceRows as (inp: any) => ListingNodeRow[]
        );
      })
      .then((rows: ListingNodeRow[]) => {
        this.sourced = R.indexBy(R.nth(ListingNode.POS_ID) as (row: any) => string, rows);
        return rows;
      })
      .catch((err: any) => {
        console.error(err.stack);
        throw err;
      });
  }

  _setChecked(id: string, checked: boolean) {
    this.checked[id] = checked;
    return resolve(checked);
  }

  checkId(scope: GunScope, id: string) {
    if (this.checked[id]) return Promise.resolve(true);
    if (this.spec.isIdSticky(id)) return this._setChecked(id, true);
    if (!(id in this.sourced)) return this._setChecked(id, false);
    const filterFn = ListingFilter.thingFilter(scope, this.spec);

    return filterFn(id).then((isPresent: any) => {
      if (!isPresent) return this._setChecked(id, false);
      const listings = this.listings.slice();
      if (!listings.length) return this._setChecked(id, true);

      let idx = 0;
      const checkNext = (): Promise<boolean> => {
        const listing = listings[idx];
        idx++;
        if (!listing) return this._setChecked(id, false);
        return listing.checkId(scope, id).then(subCheck => {
          if (subCheck) return this._setChecked(id, true);
          return checkNext();
        });
      };
      return checkNext();
    });
  }

  ids(scope: GunScope, opts = {}) {
    return this.unfilteredRows(scope).then(rows => {
      const stickyRows: ListingNodeRow[] = R.map(id => [-1, id, -Infinity], this.spec.stickyIds);
      const filterFn = (id: string) => this.checkId(scope, id);

      return ListingFilter.getFilteredIds(scope, this.spec, [...stickyRows, ...rows], {
        ...opts,
        filterFn
      });
    });
  }
}
