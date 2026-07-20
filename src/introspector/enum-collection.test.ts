import { describe, expect, it } from 'vitest';
import { EnumCollection } from './enum-collection';

describe(EnumCollection.name, () => {
  it('exposes enums as an ordinary object', () => {
    expect(Object.getPrototypeOf(new EnumCollection().enums)).toBe(
      Object.prototype,
    );
  });

  it.each(['constructor', 'toString', '__proto__'])(
    'supports the enum name %s',
    (name) => {
      const enums = new EnumCollection();

      enums.add(name, 'active');

      expect(enums.has(name)).toBe(true);
      expect(enums.get(name)).toStrictEqual(['active']);
    },
  );
});
