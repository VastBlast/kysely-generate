import type { ExportStatementNode } from './export-statement-node';
import type { ImportStatementNode } from './import-statement-node';
import type { InterfaceDeclarationNode } from './interface-declaration-node';
import type { TypeExportStatementNode } from './type-export-statement-node';

export type StatementNode =
  | ExportStatementNode
  | ImportStatementNode
  | InterfaceDeclarationNode
  | TypeExportStatementNode;
