import type { CrudRow } from "@mintcd/sync-engine/records";
import type { definition } from "./model.generated";

export type TableName = keyof typeof definition.collections;
export type Row<Table extends TableName> = CrudRow<typeof definition.collections[Table]>;
export type Database = { [Table in TableName]: Row<Table> };
