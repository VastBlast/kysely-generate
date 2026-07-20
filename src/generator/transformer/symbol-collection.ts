import type { ExpressionNode } from '../ast/expression-node';
import type { LiteralNode } from '../ast/literal-node';
import type { ModuleReferenceNode } from '../ast/module-reference-node';
import type { RuntimeEnumDeclarationNode } from '../ast/runtime-enum-declaration-node';
import type { TemplateNode } from '../ast/template-node';
import {
  toKyselyPascalCase,
  toPascalCase,
  toScreamingSnakeCase,
} from '../utils/case-converter';
import type { IdentifierStyle } from './identifier-style';

export type SymbolEntry = [id: string, symbol: SymbolNode];

type SymbolMap = Record<string, SymbolNode | undefined>;

type SymbolNameMap = Record<string, string | undefined>;

export type SymbolNode =
  | { node: ExpressionNode | TemplateNode; type: 'Definition' }
  | { node: ModuleReferenceNode; type: 'ModuleReference' }
  | { node: RuntimeEnumDeclarationNode; type: 'RuntimeEnumDefinition' }
  | { node: LiteralNode<string>; type: 'RuntimeEnumMember' }
  | { type: 'Table' };

export type SymbolType =
  | 'Definition'
  | 'ModuleReference'
  | 'RuntimeEnumDefinition'
  | 'RuntimeEnumMember'
  | 'Table';

const IDENTIFIER_START_REGEXP = /^[$_\p{ID_Start}]/u;
const INVALID_IDENTIFIER_PART_REGEXP = /[^$\p{ID_Continue}\u200c\u200d]/gu;

const convertIdentifier = (identifier: string, style: IdentifierStyle) => {
  switch (style) {
    case 'kysely-pascal-case':
      return toKyselyPascalCase(identifier);
    case 'pascal-case':
      return toPascalCase(identifier);
    case 'screaming-snake-case':
      return toScreamingSnakeCase(identifier);
  }
};

export class SymbolCollection {
  readonly identifierStyle: IdentifierStyle;
  readonly symbolNames: SymbolNameMap = {};
  readonly symbols: SymbolMap = {};
  private readonly usedNames = new Set<string>();

  constructor(options?: {
    entries?: SymbolEntry[];
    identifierStyle?: IdentifierStyle;
  }) {
    this.identifierStyle = options?.identifierStyle ?? 'kysely-pascal-case';

    const entries =
      options?.entries?.sort(([a], [b]) => a.localeCompare(b)) ?? [];

    for (const [id, symbol] of entries) {
      this.set(id, symbol);
    }
  }

  entries() {
    return Object.entries(this.symbols)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, symbol]) => ({
        id,
        name: this.symbolNames[id]!,
        symbol: symbol!,
      }));
  }

  get(id: string) {
    return Object.hasOwn(this.symbols, id) ? this.symbols[id] : undefined;
  }

  getName(id: string) {
    return Object.hasOwn(this.symbolNames, id)
      ? this.symbolNames[id]
      : undefined;
  }

  has(id: string) {
    return this.get(id) !== undefined;
  }

  reserveName(
    id: string,
    normalize?: (identifier: string) => string,
    reservedNames?: ReadonlySet<string>,
  ) {
    let symbolName = convertIdentifier(
      id.replaceAll(INVALID_IDENTIFIER_PART_REGEXP, '_'),
      this.identifierStyle,
    );

    if (normalize) {
      symbolName = normalize(symbolName).replaceAll(
        INVALID_IDENTIFIER_PART_REGEXP,
        '_',
      );
    }

    if (!symbolName) {
      symbolName = '_';
    }

    if (!IDENTIFIER_START_REGEXP.test(symbolName)) {
      symbolName = `_${symbolName}`;
    }

    const isUnavailable = (name: string) => {
      return (
        this.usedNames.has(name) || reservedNames?.has(name) === true
      );
    };

    if (isUnavailable(symbolName)) {
      let suffix = 2;

      while (isUnavailable(`${symbolName}${suffix}`)) {
        suffix++;
      }

      symbolName += suffix;
    }

    this.usedNames.add(symbolName);

    return symbolName;
  }

  set(
    id: string,
    symbol: SymbolNode,
    reservedNames?: ReadonlySet<string>,
  ) {
    const existingName = this.getName(id);

    if (existingName) {
      return existingName;
    }

    const symbolName = this.reserveName(id, undefined, reservedNames);
    Object.defineProperty(this.symbols, id, {
      configurable: true,
      enumerable: true,
      value: symbol,
      writable: true,
    });
    Object.defineProperty(this.symbolNames, id, {
      configurable: true,
      enumerable: true,
      value: symbolName,
      writable: true,
    });

    return symbolName;
  }
}
