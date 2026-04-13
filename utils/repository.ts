import { createQueryBuilder, QueryAST } from './QueryBuilder';
import { localExecutor } from './db/query';
import type { LocalSchema } from './db/LocalSchema';

function postToServiceWorker(message: any) {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      try { controller.postMessage(message); } catch (e) { /* ignore */ }
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      try { reg.active?.postMessage(message); } catch (e) { /* ignore */ }
    }).catch(() => { });
  } catch (e) { /* ignore */ }
}

export const repository = createQueryBuilder<LocalSchema>(async (ast: QueryAST) => {
  const result = await localExecutor(ast);
  if (ast.action === 'INSERT' || ast.action === 'UPDATE' || ast.action === 'DELETE') {
    postToServiceWorker({ type: 'UPDATE_REMOTE', ast });
  }
  return result;
});

export default repository;
