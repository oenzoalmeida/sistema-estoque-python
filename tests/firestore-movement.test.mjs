import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

// SDK fake: sem rede, sem autenticação, sem acessar o projeto Firebase da demo.
// Exercita o adaptador real firestore.js e seu callback, inclusive a religação da UI.
test('adaptador usa runTransaction e recalcula no retry, sem writeBatch/saldo do navegador', async () => {
  const source = await readFile(new URL('../web/firestore.js', import.meta.url), 'utf8');
  const model = asModule(await readFile(new URL('../web/model.js', import.meta.url), 'utf8'));
  const helper = asModule((await readFile(new URL('../web/movement-transaction.js', import.meta.url), 'utf8'))
    .replace("'./model.js'", JSON.stringify(model)));
  const sdk = asModule(`
    export const getFirestore = () => ({});
    export const collection = (...args) => ({ path: args.slice(1) });
    export const doc = (...args) => ({ id: args.length === 1 ? 'movement-id' : args.at(-1) });
    export const serverTimestamp = () => 'SERVER_TIME';
    export const addDoc = () => {}, setDoc = () => {}, deleteDoc = () => {};
    export const getDocs = () => {}, onSnapshot = () => {}, query = () => {}, orderBy = () => {};
    export const writeBatch = () => { throw new Error('writeBatch não protege leitura concorrente'); };
    export async function runTransaction(db, callback) {
      const writes = [];
      const attempt = balance => ({
        get: async () => ({ exists: () => true, data: () => ({ nome: 'Atual', quantidade: balance }) }),
        update: (ref, data) => writes.push(data), set: () => {},
      });
      await callback(attempt(10)); // tentativa descartada pelo SDK por conflito
      writes.length = 0;
      await callback(attempt(6)); // outra retirada já consumiu quatro unidades
      return writes;
    }
  `);
  const code = source
    .replace(/'https:\/\/www.gstatic.com\/firebasejs\/[^']+firebase-app.js'/,
      JSON.stringify(asModule('export const initializeApp = () => ({});')))
    .replace(/'https:\/\/www.gstatic.com\/firebasejs\/[^']+firebase-auth.js'/,
      JSON.stringify(asModule('export const getAuth = () => ({}); export const signInAnonymously = () => {};')))
    .replace(/'https:\/\/www.gstatic.com\/firebasejs\/[^']+firebase-firestore.js'/, JSON.stringify(sdk))
    .replace("'./movement-transaction.js'", JSON.stringify(helper));
  const { registrarMovimentacao } = await import(asModule(code));
  const writes = await registrarMovimentacao('fake-user', { id: 'p1', nome: 'Antigo', quantidade: 10 }, 'saida', 3, '', 7);
  assert.equal(writes[0].quantidade, 3); // 6 - 3, nunca o saldo pré-calculado 7
  const ui = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /registrarMovimentacao\([^;]*novaQuantidade/);
});
