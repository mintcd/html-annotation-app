import { createQueryBuilder, QueryAST } from './QueryBuilder';
import { localExecutor } from './db/query';
import type { LocalSchema } from './db/LocalSchema';

function postToServiceWorker(message: any) {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const controller = navigator.serviceWorker.controller;
    try { console.debug('repository.postToServiceWorker - hasController:', !!controller, 'message:', message); } catch (e) { /* ignore */ }
    if (controller) {
      try {
        controller.postMessage(message);
        try { console.debug('repository.postToServiceWorker - posted to controller'); } catch (e) { /* ignore */ }
      } catch (e) {
        try { console.warn('repository.postToServiceWorker - postMessage to controller failed', e); } catch (er) { /* ignore */ }
      }
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      try {
        try { console.debug('repository.postToServiceWorker - posting via registration.active', !!reg?.active); } catch (e) { /* ignore */ }
        reg.active?.postMessage(message);
      } catch (e) {
        try { console.warn('repository.postToServiceWorker - postMessage via registration failed', e); } catch (er) { /* ignore */ }
      }
    }).catch((e) => {
      try { console.warn('repository.postToServiceWorker - serviceWorker.ready failed', e); } catch (er) { /* ignore */ }
    });
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
