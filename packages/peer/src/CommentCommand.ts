import * as R from 'ramda';
import { ThingDataMap, CommandMap } from './types';
import { Constants } from './Constants';

const tokenize = R.compose(
  R.map(R.trim),
  R.split(' '),
  R.replace(Constants.COMMAND_RE, ''),
  R.defaultTo(''),
  R.nth(0) as (inpt: string[]) => string,
  R.split('\n')
);

const map = (thingData: ThingDataMap): CommandMap =>
  R.reduce(
    (cmdMap, id) => {
      const body = R.pathOr('', [id, 'body'], thingData);
      const authorId = R.pathOr('anon', [id, 'authorId'], thingData);
      const timestamp = parseFloat(R.pathOr('', [id, 'timestamp'], thingData));

      if (!R.test(Constants.COMMAND_RE, body)) return cmdMap;
      const tokenized = [authorId, ...tokenize(body), id];

      return R.assocPath(tokenized.slice(0, 6), timestamp || 0, cmdMap);
    },
    {},
    R.keys(thingData)
  );

export const CommentCommand = { tokenize, map };
