export type OperationRow = {
  id?: string;
  entity: string;
  op_type: 'insert' | 'update' | 'delete';
  payload: any;
  created_at?: number;
  processed?: boolean;
  attempts?: number;
  last_error?: string;
  client_id?: string;
  client_op_id?: string;
  sent_at?: number;
};

export type ConfigRow = { key: string; value: string };

export type SnapshotRow = {
  id: string;
  url: string;
  title?: string;
  html: string;
  resources?: string[];
  created_at: number;
};

export type LocalSchema = {
  pages: Page;
  annotations: Annotation;
  operations: OperationRow;
  snapshots: SnapshotRow;
  websites: Website;
  config: ConfigRow;
};

export type Store = keyof LocalSchema;
