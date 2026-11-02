import test from 'node:test';
import assert from 'node:assert/strict';
import { movimentarEmTransacao } from '../web/movement-transaction.js';
import { EstoqueInsuficienteError, ValidacaoError, QuantidadeInvalidaError } from '../web/model.js';

const productRef = { id: 'p1' };
const movementRef = { id: 'm1' };
function transaction(balance, exists = true) {
  const writes = [];
  return {
    writes,
    async get(ref) {
      assert.equal(ref, productRef);
      return { exists: () => exists, data: () => ({ nome: 'Produto atual', quantidade: balance }) };
    },
    update(ref, data) { writes.push({ type: 'update', ref, data }); },
    set(ref, data) { writes.push({ type: 'set', ref, data }); },
  };
}
const move = (tx, type = 'saida', quantity = 7) => movimentarEmTransacao(
  tx, productRef, movementRef, { tipo: type, quantidade: quantity, motivo: ' Venda ' }, () => 'SERVER_TIME',
);

test('usa saldo e nome lidos dentro da transação e grava saldo/histórico juntos', async () => {
  const tx = transaction(10);
  assert.equal(await move(tx), 3);
  assert.equal(tx.writes[0].data.quantidade, 3);
  assert.deepEqual(tx.writes[1].data, {
    produtoId: 'p1', produtoNome: 'Produto atual', tipo: 'saida', quantidade: 7,
    motivo: 'Venda', criadoEm: 'SERVER_TIME',
  });
});

test('retry após outra saída usa saldo novo e impede estoque negativo', async () => {
  const firstAttempt = transaction(10);
  await move(firstAttempt); // tentativa que seria descartada pelo SDK por conflito
  const retried = transaction(3);
  await assert.rejects(move(retried), EstoqueInsuficienteError);
  assert.equal(retried.writes.length, 0);
});

test('retry válido preserva ambas as saídas em vez de sobrescrever saldo antigo', async () => {
  const tx = transaction(6); // outra transação retirou 4 de um saldo 10
  await move(tx, 'saida', 3);
  assert.equal(tx.writes[0].data.quantidade, 3);
});

test('produto removido não é recriado e não gera histórico', async () => {
  const tx = transaction(10, false);
  await assert.rejects(move(tx), ValidacaoError);
  assert.equal(tx.writes.length, 0);
});

test('entrada relê saldo e soma quantidade', async () => {
  const tx = transaction(4);
  await move(tx, 'entrada', 2);
  assert.equal(tx.writes[0].data.quantidade, 6);
});

for (const quantity of [0, -1, 1.5, NaN]) {
  test(`quantidade inválida ${quantity} não grava nada`, async () => {
    const tx = transaction(10);
    await assert.rejects(move(tx, 'saida', quantity), QuantidadeInvalidaError);
    assert.equal(tx.writes.length, 0);
  });
}
