import { createQueryBuilder, QueryAST, ConditionNode, UpdateAST, SelectAST, DeleteAST } from '../QueryBuilder';
import localDb from './indexedDB';
import type { LocalSchema, Store } from './LocalSchema';

export const localExecutor = async (ast: QueryAST) => {
  const table = ast.table as Store;
  const where = (ast as SelectAST).where as ConditionNode | undefined;
  let candidates: any[] = [];

  switch (ast.action) {
    case 'SELECT':
      candidates = await fetchCandidates(ast);
      const filtered = candidates.filter(r => matchWhere(r, where));

      return ast.action === 'SELECT' && ast.select && ast.select.length
        ? filtered.map(r => {
          const out: any = {};
          for (const f of ast.select!) out[String(f)] = (r as any)[String(f)];
          return out;
        })
        : filtered;

    case 'INSERT': {
      const data = ast.insert as any;
      const rawItems = Array.isArray(data) ? data : [data];
      if (!rawItems.length) return [];

      const prepared = rawItems.map((d: any) => fillDefaults(table, d));

      await Promise.all(prepared.map((d: any) => localDb.putRow(table, d)));

      try {
        await Promise.all(prepared.map((d: any) => localDb.putRow('operations' as any, {
          entity: table as string,
          op_type: 'insert',
          payload: d,
          created_at: Date.now(),
          processed: false,
          attempts: 0,
        } as any)));
      } catch (e) { /* ignore enqueue failures */ }

      return [];
    }

    case 'UPDATE': {
      const updates = (ast as UpdateAST).update || {};
      candidates = await fetchCandidates(ast);

      const toUpdateOriginals = candidates.filter(r => matchWhere(r, (ast as UpdateAST).where));
      if (!toUpdateOriginals.length) return [];

      const toUpdate = toUpdateOriginals.map(r => ({ ...r, ...updates }));

      if (table === 'pages') {
        for (const r of toUpdate) {
          try { if ((r as any).created_at === undefined) (r as any).created_at = Date.now(); } catch (e) { }
        }
      }

      await Promise.all(toUpdate.map(r => localDb.putRow(table, r as any)));

      try {
        await Promise.all(toUpdate.map(r => localDb.putRow('operations' as any, {
          entity: table as string,
          op_type: 'update',
          payload: { id: (r as any).id, changes: updates },
          created_at: Date.now(),
          processed: false,
          attempts: 0,
        } as any)));
      } catch (e) { /* ignore */ }

      return [];
    }

    case 'DELETE': {
      candidates = await fetchCandidates(ast);
      const toDelete = candidates.filter(r => matchWhere(r, (ast as DeleteAST).where));
      if (!toDelete.length) return [];

      await Promise.all(toDelete.map(r => localDb.deleteRow(table, (r as any).id)));

      try {
        await Promise.all(toDelete.map(r => localDb.putRow('operations' as any, {
          entity: table as string,
          op_type: 'delete',
          payload: { id: (r as any).id },
          created_at: Date.now(),
          processed: false,
          attempts: 0,
        } as any)));
      } catch (e) { /* ignore */ }
      return [];
    }
  }
};

export const local = createQueryBuilder<LocalSchema>(localExecutor);

function fillDefaults(table: string, d: any) {
  if (!d) return d;
  if (d.id === undefined || d.id === null) d.id = Date.now().toString();

  if (table === 'pages') {
    if (d.number_of_scripts === undefined) d.number_of_scripts = 0;
    if (d.number_of_annotations === undefined) d.number_of_annotations = 0;
    if (d.created_at === undefined) d.created_at = Date.now();
    if (d.updated_at === undefined) d.updated_at = Date.now();
  }

  if (table === 'annotations') {
    if (d.created_at === undefined) d.created_at = Date.now();
    if (d.updated_at === undefined) d.updated_at = Date.now();
  }

  return d;
}

function matchWhere(item: any, where?: ConditionNode): boolean {
  if (!where) return true;
  if (where.operator === 'AND' && where.where) return where.where.every(c => matchWhere(item, c));
  if (where.operator === 'OR' && where.where) return where.where.some(c => matchWhere(item, c));
  if (where.operator === '=' && where.field) return item[where.field] === where.value;
  if (where.operator === '>' && where.field) return item[where.field] > where.value;
  if (where.operator === '<' && where.field) return item[where.field] < where.value;
  return false;
}

async function fetchCandidates(ast: QueryAST): Promise<any[]> {
  const table = ast.table as Store;
  const where = (ast as SelectAST).where as ConditionNode | undefined;

  if (!where) return await localDb.getAllRows(table);

  if (where && where.operator === '=' && where.field === 'id') {
    try {
      const r = await localDb.getRow(table, where.value);
      return r ? [r] : [];
    } catch (e) { return []; }
  }

  if (where && where.operator === '=' && where.field) {
    const idx = where.field;
    try {
      const res = await localDb.queryIndex(table, idx, where.value);
      return res as LocalSchema[typeof table][];
    } catch (e) {
      const all = await localDb.getAllRows(table);
      return all;
    }
  }

  const all = await localDb.getAllRows(table);
  return all.filter(r => matchWhere(r, where));
}
