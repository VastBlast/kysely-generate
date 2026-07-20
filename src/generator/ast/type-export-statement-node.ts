export class TypeExportStatementNode {
  readonly alias: string;
  readonly name: string;
  readonly type = 'TypeExportStatement';

  constructor(name: string, alias: string) {
    this.alias = alias;
    this.name = name;
  }
}
