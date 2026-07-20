import { deepStrictEqual, strictEqual } from 'node:assert';
import { IdentifierNode } from '../ast/identifier-node';
import type { SymbolNode } from './symbol-collection';
import { SymbolCollection } from './symbol-collection';
import { test } from 'vitest';

test(SymbolCollection.name, () => {
  const symbols = new SymbolCollection();
  const symbol: SymbolNode = {
    node: new IdentifierNode('FooBar'),
    type: 'Definition',
  };

  symbols.set('foo-bar', symbol);
  symbols.set('foo__bar__', symbol);
  symbols.set('__foo__bar__', symbol);
  symbols.set('Foo, Bar!', symbol);
  symbols.set('Foo$Bar', symbol);
  symbols.set('0x123', symbol);
  symbols.set('!', symbol);
  symbols.set('"', symbol);
  symbols.set('élèves-items', symbol);
  symbols.set('東京_items', symbol);
  symbols.set('١users', symbol);

  deepStrictEqual(symbols.symbolNames, {
    'foo-bar': 'FooBar',
    foo__bar__: 'FooBar2',
    __foo__bar__: '_FooBar',
    'Foo, Bar!': 'FooBar3',
    Foo$Bar: 'Foo$Bar',
    '0x123': '_0x123',
    '!': '_',
    '"': '_2',
    'élèves-items': 'ÉlèvesItems',
    東京_items: '東京Items',
    '١users': '_١users',
  });

  for (const id of ['constructor', 'toString', '__proto__']) {
    const name = symbols.set(id, symbol);

    strictEqual(symbols.get(id), symbol);
    strictEqual(symbols.getName(id), name);
    strictEqual(symbols.has(id), true);
  }

  const mutableSymbols = new SymbolCollection();
  mutableSymbols.symbolNames.external = 'Manual';
  strictEqual(mutableSymbols.set('manual', symbol), 'Manual2');
  delete mutableSymbols.symbolNames.external;
  strictEqual(mutableSymbols.set('manual!', symbol), 'Manual');
});
