import { Adapter } from '../../adapter';
import { ColumnTypeNode } from '../../ast/column-type-node';
import { IdentifierNode } from '../../ast/identifier-node';
import { UnionExpressionNode } from '../../ast/union-expression-node';

export class MssqlAdapter extends Adapter {
  override readonly definitions = {
    Int8: new ColumnTypeNode(
      new IdentifierNode('string'),
      new UnionExpressionNode([
        new IdentifierNode('bigint'),
        new IdentifierNode('number'),
        new IdentifierNode('string'),
      ]),
      new UnionExpressionNode([
        new IdentifierNode('bigint'),
        new IdentifierNode('number'),
        new IdentifierNode('string'),
      ]),
    ),
    RowVersion: new ColumnTypeNode(
      new IdentifierNode('Buffer'),
      new IdentifierNode('never'),
      new IdentifierNode('never'),
    ),
  };
  // https://github.com/tediousjs/tedious/tree/master/src/data-types
  override readonly scalars = {
    bigint: new IdentifierNode('Int8'),
    binary: new IdentifierNode('Buffer'),
    bit: new IdentifierNode('boolean'),
    char: new IdentifierNode('string'),
    date: new IdentifierNode('Date'),
    datetime: new IdentifierNode('Date'),
    datetime2: new IdentifierNode('Date'),
    datetimeoffset: new IdentifierNode('Date'),
    decimal: new IdentifierNode('number'),
    double: new IdentifierNode('number'),
    float: new IdentifierNode('number'),
    image: new IdentifierNode('Buffer'),
    int: new IdentifierNode('number'),
    money: new IdentifierNode('number'),
    nchar: new IdentifierNode('string'),
    ntext: new IdentifierNode('string'),
    number: new IdentifierNode('number'),
    numeric: new IdentifierNode('number'),
    nvarchar: new IdentifierNode('string'),
    real: new IdentifierNode('number'),
    rowversion: new IdentifierNode('RowVersion'),
    smalldatetime: new IdentifierNode('Date'),
    smallint: new IdentifierNode('number'),
    smallmoney: new IdentifierNode('number'),
    text: new IdentifierNode('string'),
    time: new IdentifierNode('Date'),
    timestamp: new IdentifierNode('RowVersion'),
    tinyint: new IdentifierNode('number'),
    tvp: new IdentifierNode('unknown'),
    uniqueidentifier: new IdentifierNode('string'),
    varbinary: new IdentifierNode('Buffer'),
    varchar: new IdentifierNode('string'),
    xml: new IdentifierNode('string'),
  };
}
