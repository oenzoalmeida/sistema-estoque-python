import test from 'node:test';
import assert from 'node:assert/strict';
import {
  situacaoDo, validarProduto, aplicarMovimentacao, descreverMovimentacao,
  filtrar, categoriasDe, dashboard, formatarMoeda,
  QuantidadeInvalidaError, EstoqueInsuficienteError, ValidacaoError,
} from '../web/model.js';

const p = (over = {}) => ({
  id: 'p1', nome: 'Mouse Logitech', descricao: '', categoria: 'Periféricos',
  quantidade: 10, estoqueMinimo: 5, preco: 129.9, ...over,
});

// ---- validações de cadastro ----
test('cadastro aceita produto válido', () => {
  assert.doesNotThrow(() => validarProduto({ nome: 'Cabo HDMI', quantidade: 3, estoqueMinimo: 2, preco: 29.9 }));
});
test('cadastro rejeita nome vazio', () => {
  assert.throws(() => validarProduto({ nome: '  ', quantidade: 1, estoqueMinimo: 0, preco: 1 }), ValidacaoError);
});
test('cadastro rejeita quantidade negativa', () => {
  assert.throws(() => validarProduto({ nome: 'X', quantidade: -1, estoqueMinimo: 0, preco: 1 }), ValidacaoError);
});
test('cadastro rejeita quantidade fracionada', () => {
  assert.throws(() => validarProduto({ nome: 'X', quantidade: 1.5, estoqueMinimo: 0, preco: 1 }), ValidacaoError);
});
test('cadastro rejeita estoque mínimo negativo', () => {
  assert.throws(() => validarProduto({ nome: 'X', quantidade: 1, estoqueMinimo: -2, preco: 1 }), ValidacaoError);
});
test('cadastro rejeita preço negativo', () => {
  assert.throws(() => validarProduto({ nome: 'X', quantidade: 1, estoqueMinimo: 0, preco: -0.01 }), ValidacaoError);
});
test('cadastro aceita preço zero e quantidade zero', () => {
  assert.doesNotThrow(() => validarProduto({ nome: 'X', quantidade: 0, estoqueMinimo: 0, preco: 0 }));
});

// ---- entrada e saída (regras do main.py original) ----
test('entrada soma ao estoque', () => {
  assert.equal(aplicarMovimentacao(10, 'entrada', 5), 15);
});
test('saída reduz o estoque', () => {
  assert.equal(aplicarMovimentacao(10, 'saida', 4), 6);
});
test('saída de todo o estoque deixa zero', () => {
  assert.equal(aplicarMovimentacao(10, 'saida', 10), 0);
});
test('entrada com zero lança erro', () => {
  assert.throws(() => aplicarMovimentacao(10, 'entrada', 0), QuantidadeInvalidaError);
});
test('entrada com valor negativo lança erro', () => {
  assert.throws(() => aplicarMovimentacao(10, 'entrada', -3), QuantidadeInvalidaError);
});
test('saída maior que o estoque lança erro (nunca fica negativo)', () => {
  assert.throws(() => aplicarMovimentacao(5, 'saida', 6), EstoqueInsuficienteError);
});
test('saída fracionada lança erro', () => {
  assert.throws(() => aplicarMovimentacao(10, 'saida', 0.5), QuantidadeInvalidaError);
});
test('tipo inválido lança erro', () => {
  assert.throws(() => aplicarMovimentacao(10, 'ajuste', 1), ValidacaoError);
});

// ---- situações de estoque ----
test('produto normal acima do mínimo', () => {
  assert.equal(situacaoDo(p({ quantidade: 6, estoqueMinimo: 5 })), 'normal');
});
test('produto com estoque exatamente no mínimo é normal', () => {
  assert.equal(situacaoDo(p({ quantidade: 5, estoqueMinimo: 5 })), 'normal');
});
test('produto abaixo do mínimo é estoque baixo', () => {
  assert.equal(situacaoDo(p({ quantidade: 4, estoqueMinimo: 5 })), 'baixo');
});
test('produto com zero é sem estoque', () => {
  assert.equal(situacaoDo(p({ quantidade: 0, estoqueMinimo: 5 })), 'zerado');
});
test('zerado prevalece sobre baixo', () => {
  assert.equal(situacaoDo(p({ quantidade: 0, estoqueMinimo: 0 })), 'zerado');
});

// ---- histórico ----
test('descrição de entrada sem motivo', () => {
  assert.equal(descreverMovimentacao({ tipo: 'entrada', produtoNome: 'Mouse', quantidade: 3 }), 'Entrada de 3 × Mouse');
});
test('descrição de saída com motivo', () => {
  const d = descreverMovimentacao({ tipo: 'saida', produtoNome: 'Mouse', quantidade: 2, motivo: 'Venda balcão' });
  assert.equal(d, 'Saída de 2 × Mouse — Venda balcão');
});

// ---- busca e filtros ----
const lista = [
  p({ id: '1', nome: 'Mouse Logitech', categoria: 'Periféricos', quantidade: 10, estoqueMinimo: 5 }),
  p({ id: '2', nome: 'Teclado Mecânico', categoria: 'Periféricos', quantidade: 3, estoqueMinimo: 5 }),
  p({ id: '3', nome: 'Monitor Dell', categoria: 'Telas', quantidade: 0, estoqueMinimo: 2 }),
  p({ id: '4', nome: 'Cabo HDMI', categoria: 'Cabos', quantidade: 7, estoqueMinimo: 3 }),
];
test('busca por nome contém e ignora caixa', () => {
  assert.equal(filtrar(lista, { busca: 'MOUSE' }).length, 1);
  assert.equal(filtrar(lista, { busca: 'ecân' }).length, 1);
});
test('filtro por categoria', () => {
  assert.deepEqual(filtrar(lista, { categoria: 'Periféricos' }).map((x) => x.id), ['1', '2']);
});
test('filtro por situação baixo', () => {
  assert.deepEqual(filtrar(lista, { situacao: 'baixo' }).map((x) => x.id), ['2']);
});
test('filtro por situação zerado', () => {
  assert.deepEqual(filtrar(lista, { situacao: 'zerado' }).map((x) => x.id), ['3']);
});
test('filtros combinados', () => {
  assert.deepEqual(filtrar(lista, { busca: 'tec', situacao: 'baixo' }).map((x) => x.id), ['2']);
  assert.equal(filtrar(lista, { busca: 'tec', situacao: 'zerado' }).length, 0);
});
test('categorias distintas e ordenadas', () => {
  assert.deepEqual(categoriasDe(lista), ['Cabos', 'Periféricos', 'Telas']);
});

// ---- dashboard ----
test('dashboard agrega totais e situações', () => {
  const d = dashboard(lista, [{ id: 'm1', tipo: 'saida', produtoNome: 'Mouse', quantidade: 1 }]);
  assert.equal(d.totalProdutos, 4);
  assert.equal(d.quantidadeTotal, 20);
  assert.equal(d.estoqueBaixo, 1);
  assert.equal(d.semEstoque, 1);
  assert.deepEqual(d.listaZerados, ['Monitor Dell']);
  assert.equal(d.movimentacoesRecentes.length, 1);
});
test('dashboard calcula valor total do estoque (regra do original)', () => {
  const d = dashboard([p({ quantidade: 2, preco: 10 }), p({ quantidade: 3, preco: 5.5 })]);
  assert.equal(d.valorTotal, 20 + 16.5);
});
test('dashboard de lista vazia não quebra', () => {
  const d = dashboard([]);
  assert.equal(d.totalProdutos, 0);
  assert.equal(d.valorTotal, 0);
});
test('movimentações recentes limitadas a 8', () => {
  const movs = Array.from({ length: 15 }, (_, i) => ({ id: String(i) }));
  assert.equal(dashboard(lista, movs).movimentacoesRecentes.length, 8);
});

// ---- formatação ----
test('moeda em BRL', () => {
  assert.equal(formatarMoeda(129.9).replace('\u00a0', ' '), 'R$ 129,90');
});

// ---- tabela compartilhada com a versão Python ----
// Os mesmos casos de tests/casos-movimentacao.json são exercitados pela suíte
// Python (tests/test_estoque.py), sobre a classe Produto do main.py. As duas
// implementações das mesmas regras de entrada e saída não podem divergir em
// silêncio: um caso acrescentado ao arquivo passa a valer para os dois lados.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CASOS = JSON.parse(readFileSync(join(AQUI, 'casos-movimentacao.json'), 'utf8'));

test('a tabela compartilhada tem casos', () => {
  assert.ok(CASOS.movimentacoes.length > 8);
});

test('tabela compartilhada: movimentações válidas', () => {
  for (const caso of CASOS.movimentacoes) {
    if (caso.erro) continue;
    const obtido = aplicarMovimentacao(caso.atual, caso.tipo, caso.quantidade);
    assert.equal(obtido, caso.esperado, `${caso.atual} ${caso.tipo} ${caso.quantidade}`);
  }
});

test('tabela compartilhada: quantidade inválida é recusada', () => {
  for (const caso of CASOS.movimentacoes) {
    if (caso.erro !== 'quantidade-invalida') continue;
    assert.throws(
      () => aplicarMovimentacao(caso.atual, caso.tipo, caso.quantidade),
      QuantidadeInvalidaError,
      `${caso.atual} ${caso.tipo} ${caso.quantidade}`
    );
  }
});

test('tabela compartilhada: estoque insuficiente é recusado', () => {
  for (const caso of CASOS.movimentacoes) {
    if (caso.erro !== 'estoque-insuficiente') continue;
    assert.throws(
      () => aplicarMovimentacao(caso.atual, caso.tipo, caso.quantidade),
      EstoqueInsuficienteError,
      `${caso.atual} ${caso.tipo} ${caso.quantidade}`
    );
  }
});
