/**
 * Motor do Sistema de Estoque — port das regras do main.py (Python).
 * Puro, sem DOM e sem Firestore, para facilitar testes.
 *
 * Regras herdadas da versão acadêmica:
 * - quantidade de movimentação precisa ser maior que zero
 * - saída não pode exceder o estoque (nunca fica negativo)
 * - produto não pode ter nome duplicado
 * - quantidade, estoque mínimo e preço não podem ser negativos
 * - valor em estoque = quantidade × preço
 */

export class QuantidadeInvalidaError extends Error {
  constructor(msg = 'A quantidade precisa ser maior que zero.') {
    super(msg);
    this.name = 'QuantidadeInvalidaError';
  }
}

export class EstoqueInsuficienteError extends Error {
  constructor(disponivel) {
    super(`Estoque insuficiente. Disponível: ${disponivel}.`);
    this.name = 'EstoqueInsuficienteError';
    this.disponivel = disponivel;
  }
}

export class ValidacaoError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ValidacaoError';
  }
}

/** Situação do produto em relação ao estoque mínimo. */
export function situacaoDo(produto) {
  if (produto.quantidade === 0) return 'zerado';
  if (produto.quantidade < produto.estoqueMinimo) return 'baixo';
  return 'normal';
}

export const SITUACAO_ROTULO = {
  normal: 'Normal',
  baixo: 'Estoque baixo',
  zerado: 'Sem estoque',
};

/** Valida os dados de um produto no cadastro/edição. Lança ValidacaoError. */
export function validarProduto({ nome, quantidade, estoqueMinimo, preco }) {
  if (!nome || !nome.trim()) throw new ValidacaoError('Informe o nome do produto.');
  if (!Number.isFinite(quantidade) || quantidade < 0 || !Number.isInteger(quantidade)) {
    throw new ValidacaoError('Quantidade deve ser um número inteiro maior ou igual a zero.');
  }
  if (!Number.isFinite(estoqueMinimo) || estoqueMinimo < 0 || !Number.isInteger(estoqueMinimo)) {
    throw new ValidacaoError('Estoque mínimo deve ser um número inteiro maior ou igual a zero.');
  }
  if (!Number.isFinite(preco) || preco < 0) {
    throw new ValidacaoError('Preço não pode ser negativo.');
  }
}

/** Aplica entrada ou saída sobre a quantidade atual. Puro: retorna a nova quantidade. */
export function aplicarMovimentacao(quantidadeAtual, tipo, quantidade) {
  if (!Number.isInteger(quantidade) || quantidade <= 0) throw new QuantidadeInvalidaError();
  if (tipo === 'entrada') return quantidadeAtual + quantidade;
  if (tipo === 'saida') {
    if (quantidade > quantidadeAtual) throw new EstoqueInsuficienteError(quantidadeAtual);
    return quantidadeAtual - quantidade;
  }
  throw new ValidacaoError('Tipo de movimentação inválido.');
}

/** Formata um texto de movimentação para o histórico. */
export function descreverMovimentacao({ tipo, produtoNome, quantidade, motivo }) {
  const verbo = tipo === 'entrada' ? 'Entrada' : 'Saída';
  return motivo && motivo.trim()
    ? `${verbo} de ${quantidade} × ${produtoNome} — ${motivo.trim()}`
    : `${verbo} de ${quantidade} × ${produtoNome}`;
}

/** Busca por nome (contém, case-insensitive) + filtros por categoria e situação. */
export function filtrar(produtos, { busca = '', categoria = '', situacao = '' } = {}) {
  const termo = busca.trim().toLowerCase();
  return produtos.filter((p) => {
    if (termo && !p.nome.toLowerCase().includes(termo)) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (situacao && situacaoDo(p) !== situacao) return false;
    return true;
  });
}

/** Categorias distintas e ordenadas. */
export function categoriasDe(produtos) {
  return [...new Set(produtos.map((p) => p.categoria).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

/** Agregados do dashboard. */
export function dashboard(produtos, movimentacoes = []) {
  const totalProdutos = produtos.length;
  const quantidadeTotal = produtos.reduce((s, p) => s + p.quantidade, 0);
  const valorTotal = produtos.reduce((s, p) => s + p.quantidade * (p.preco || 0), 0);
  const baixos = produtos.filter((p) => situacaoDo(p) === 'baixo');
  const zerados = produtos.filter((p) => situacaoDo(p) === 'zerado');
  return {
    totalProdutos,
    quantidadeTotal,
    valorTotal,
    estoqueBaixo: baixos.length,
    semEstoque: zerados.length,
    listaBaixos: baixos.map((p) => p.nome),
    listaZerados: zerados.map((p) => p.nome),
    movimentacoesRecentes: [...movimentacoes].slice(0, 8),
  };
}

/** Formata preço em BRL. */
export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
