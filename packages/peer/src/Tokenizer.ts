import * as R from 'ramda';

const tokenize = (source: string) => {
  const tokenMap = (source || '').split('\n').reduce((def, line) => {
    const tokens = line
      .trim()
      .split(' ')
      .map(R.trim)
      .filter(x => x);

    if (!tokens.length) return def;

    return R.assocPath(tokens.slice(0, 6), {}, def);
  }, {});

  const isPresent = (p: string | string[]) => {
    let check = p;

    if (typeof p === 'string') check = p.split(' ');
    return check && R.path(check as string[], tokenMap);
  };

  const getValues = (p: string | string[]): string[] => R.keysIn(isPresent(p));
  const getValue = (p: string | string[]): string | null => getValues(p)[0] || null;
  const getLastValue = (p: string | string[]) => getValues(p).pop() || null;

  const getValueChain = (p: string | string[]) => {
    const keys = typeof p === 'string' ? p.split(' ') : p;
    const values = [];
    let next = 'start';

    while (next) {
      next = getValue([...keys, ...values]) || '';
      next && values.push(next);
    }

    return values;
  };

  const getPairs = (p: string | string[]) => {
    const keys = typeof p === 'string' ? p.split(' ') : p;

    return getValues(keys).reduce((pairs: any[], key: string) => {
      const vals = getValues([...keys, key]);

      return [...pairs, ...vals.map(val => [key, val])];
    }, []);
  };

  return {
    source,
    isPresent,
    getValue,
    getValues,
    getLastValue,
    getValueChain,
    getPairs
  };
};

export const Tokenizer = { tokenize };
