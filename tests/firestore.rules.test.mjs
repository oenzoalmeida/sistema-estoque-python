// Testes das regras do Firestore (firestore.rules) contra o emulador local
// descartável — projeto "demo-*", nenhum acesso ao projeto de produção.
// Roda via: firebase emulators:exec --only firestore --project demo-oenzoa-estoque 'node tests/firestore.rules.test.mjs'
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const rules = readFileSync('firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-oenzoa-estoque',
  firestore: { rules },
});

const alice = testEnv.authenticatedContext('alice').firestore();
const bob = testEnv.authenticatedContext('bob').firestore();
const anon = testEnv.unauthenticatedContext().firestore();

const produtoValido = { nome: 'Mouse', descricao: '', categoria: 'Periféricos', quantidade: 3, estoqueMinimo: 1, preco: 99.9 };

// dono cria e lê produto válido no próprio espaço
await assertSucceeds(setDoc(doc(alice, 'users/alice/products/p1'), produtoValido));
await assertSucceeds(getDoc(doc(alice, 'users/alice/products/p1')));
// outro usuário autenticado não lê o estoque alheio
await assertFails(getDoc(doc(bob, 'users/alice/products/p1')));
// anônimo não lê nada
await assertFails(getDoc(doc(anon, 'users/alice/products/p1')));
// validação de campos: quantidade negativa é barrada
await assertFails(setDoc(doc(alice, 'users/alice/products/p2'), { ...produtoValido, quantidade: -1 }));
// movimentações: criação válida entra; update e delete são negados (imutáveis)
await assertSucceeds(setDoc(doc(alice, 'users/alice/movements/m1'), { produtoId: 'p1', produtoNome: 'Mouse', tipo: 'entrada', quantidade: 2 }));
await assertFails(setDoc(doc(alice, 'users/alice/movements/m1'), { produtoId: 'p1', produtoNome: 'Mouse', tipo: 'saida', quantidade: 1 }));
await assertFails(deleteDoc(doc(alice, 'users/alice/movements/m1')));

await testEnv.cleanup();
console.log('firestore.rules: 8 verificações passaram no emulador');
