// Valida o caminho transacional real (web/movement-transaction.js) contra o
// emulador do Firestore com escritores concorrentes de verdade: N transações
// simultâneas no mesmo produto. Só roda com FIRESTORE_EMULATOR_HOST definido;
// nos jobs que executam `node --test tests/*.test.mjs` sem emulador, a suíte
// é pulada sem falhar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;

test('escritas concorrentes no mesmo produto serializam sem perder movimentações', { skip: !HOST }, async (t) => {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  const { collection, doc, getDocs, deleteDoc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const { movimentarEmTransacao } = await import('../web/movement-transaction.js');

  const [host, port] = HOST.split(':');
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-oenzoa-estoque',
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'), host, port: Number(port) },
  });
  t.after(() => testEnv.cleanup());
  await testEnv.clearFirestore();
  const uid = 'uid-concorrencia';
  const db = testEnv.authenticatedContext(uid).firestore();
  const produtoRef = doc(db, 'users', uid, 'products', 'p1');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('users/' + uid + '/products/p1').set({
      nome: 'Produto concorrência', categoria: 'teste', quantidade: 20, estoqueMinimo: 0, preco: 1,
    });
  });

  // 10 transações concorrentes, cada uma retirando 2 unidades do mesmo produto.
  const N = 10;
  await Promise.all(Array.from({ length: N }, (_, i) => runTransaction(db, (tx) =>
    movimentarEmTransacao(tx, produtoRef, doc(collection(db, 'users', uid, 'movements')),
      { tipo: 'saida', quantidade: 2, motivo: `saida ${i}` }, () => serverTimestamp()))));

  let final;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    final = (await ctx.firestore().doc('users/' + uid + '/products/p1').get()).data();
  });
  assert.equal(final.quantidade, 20 - N * 2, 'saldo final reflete TODAS as retiradas, sem lost update');
  const movs = await getDocs(collection(db, 'users', uid, 'movements'));
  assert.equal(movs.size, N, 'cada transação criou exatamente uma movimentação');
  // Delete after the transaction read, before its first commit. Firestore must
  // retry against the missing product, not resurrect it or append history.
  const deletingRef = doc(db, 'users', uid, 'products', 'deleted');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('users/' + uid + '/products/deleted').set({
      nome: 'Removido', categoria: 'teste', quantidade: 10, estoqueMinimo: 0, preco: 1,
    });
  });
  let removed = false;
  await assert.rejects(runTransaction(db, async (tx) => {
    const guarded = {
      async get(ref) {
        const snapshot = await tx.get(ref);
        if (!removed) { removed = true; await deleteDoc(deletingRef); }
        return snapshot;
      },
      update: (...args) => tx.update(...args),
      set: (...args) => tx.set(...args),
    };
    return movimentarEmTransacao(guarded, deletingRef,
      doc(collection(db, 'users', uid, 'movements')),
      { tipo: 'saida', quantidade: 1, motivo: 'delete concorrente' }, () => serverTimestamp());
  }), (error) => error.message.includes('Produto não encontrado') ||
    error.code === 'permission-denied' || error.code === 'not-found');
  let exists;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    exists = (await ctx.firestore().doc('users/' + uid + '/products/deleted').get()).exists;
  });
  assert.equal(exists, false);
  assert.equal((await getDocs(collection(db, 'users', uid, 'movements'))).size, N,
    'exclusão concorrente não cria movimento órfão');
});
