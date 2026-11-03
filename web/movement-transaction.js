import { aplicarMovimentacao, ValidacaoError } from './model.js';

/** Callback isolado do SDK para teste sem rede ou credenciais. */
export async function movimentarEmTransacao(transaction, produtoRef, movimentoRef,
  { tipo, quantidade, motivo }, timestamp) {
  const snapshot = await transaction.get(produtoRef);
  if (!snapshot.exists()) throw new ValidacaoError('Produto não encontrado.');
  const produto = snapshot.data();
  const novaQuantidade = aplicarMovimentacao(produto.quantidade, tipo, quantidade);
  transaction.update(produtoRef, { quantidade: novaQuantidade, atualizadoEm: timestamp() });
  transaction.set(movimentoRef, {
    produtoId: produtoRef.id,
    produtoNome: produto.nome,
    tipo,
    quantidade,
    motivo: motivo?.trim() || '',
    criadoEm: timestamp(),
  });
  return novaQuantidade;
}
