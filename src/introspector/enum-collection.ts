type EnumMap = Record<string, string[] | undefined>;

export class EnumCollection {
  readonly enums: EnumMap = {};

  constructor(enums: EnumMap = {}) {
    for (const [key, value] of Object.entries(enums)) {
      this.#set(key, value);
    }
  }

  add(key: string, value: string) {
    const values = this.#get(key);

    if (values) {
      values.push(value);
    } else {
      this.#set(key, [value]);
    }
  }

  get(key: string) {
    return this.#get(key)?.sort((a, b) => a.localeCompare(b)) ?? null;
  }

  has(key: string) {
    return this.#get(key) !== undefined;
  }

  set(key: string, values: string[]) {
    this.#set(key, values);
  }

  #get(key: string) {
    const normalizedKey = key.toLowerCase();
    return Object.hasOwn(this.enums, normalizedKey)
      ? this.enums[normalizedKey]
      : undefined;
  }

  #set(key: string, values: string[] | undefined) {
    Object.defineProperty(this.enums, key.toLowerCase(), {
      configurable: true,
      enumerable: true,
      value: values,
      writable: true,
    });
  }
}
