import {
  iniciarAutenticacao, ouvirDados, criarProduto, atualizarProduto,
  registrarMovimentacao, excluirProduto,
} from './firestore.js';
import {
  situacaoDo, SITUACAO_ROTULO, validarProduto, aplicarMovimentacao,
  descreverMovimentacao, filtrar, categoriasDe, dashboard, formatarMoeda,
  QuantidadeInvalidaError, EstoqueInsuficienteError, ValidacaoError,
} from './model.js';

const $ = (id) => document.getElementById(id);

const estado = {
  uid: null,
  produtos: [],
  movimentos: [],
  produtoEditando: null,
  movimento: { produto: null, tipo: null },
  exclusao: null,
};

const el = {
  app: $('app'), loading: $('loading'),
  kpiTotal: $('kpi-total'), kpiQuantidade: $('kpi-quantidade'), kpiValor: $('kpi-valor'),
  kpiBaixo: $('kpi-baixo'), kpiZerado: $('kpi-zerado'),
  listaBaixos: $('lista-baixos'), listaZerados: $('lista-zerados'),
  cardBaixo: $('card-baixo'), cardZerado: $('card-zerado'),
  busca: $('busca'), filtroCategoria: $('filtro-categoria'), filtroSituacao: $('filtro-situacao'),
  corpo: $('corpo-tabela'), tabelaVazia: $('tabela-vazia'), vazioDica: $('vazio-dica'),
  historico: $('historico'), historicoVazio: $('historico-vazio'),
  sugestoes: $('sugestoes-categorias'),
  modalProduto: $('modal-produto'), formProduto: $('form-produto'),
  modalProdutoTitulo: $('modal-produto-titulo'), formErro: $('form-erro'),
  modalMovimento: $('modal-movimento'), formMovimento: $('form-movimento'),
  modalMovimentoTitulo: $('modal-movimento-titulo'), movProduto: $('mov-produto'),
  movErro: $('mov-erro'), btnConfirmarMovimento: $('btn-confirmar-movimento'),
  modalExcluir: $('modal-excluir'), excluirTexto: $('excluir-texto'),
  toast: $('toast'),
};

// ---------- feedback ----------

let toastTimer;
function toast(mensagem, erro = false) {
  el.toast.textContent = mensagem;
  el.toast.classList.toggle('erro', erro);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3200);
}

function quando(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ---------- render ----------

function produtosFiltrados() {
  return filtrar(estado.produtos, {
    busca: el.busca.value,
    categoria: el.filtroCategoria.value,
    situacao: el.filtroSituacao.value,
  });
}

function renderDashboard() {
  const d = dashboard(estado.produtos, estado.movimentos);
  el.kpiTotal.textContent = d.totalProdutos;
  el.kpiQuantidade.textContent = d.quantidadeTotal;
  el.kpiValor.textContent = formatarMoeda(d.valorTotal);
  el.kpiBaixo.textContent = d.estoqueBaixo;
  el.kpiZerado.textContent = d.semEstoque;
  el.cardBaixo.classList.toggle('ativo', d.estoqueBaixo > 0);
  el.listaBaixos.textContent = d.listaBaixos.slice(0, 3).join(', ');
  el.cardZerado.classList.toggle('ativo', d.semEstoque > 0);
  el.listaZerados.textContent = d.listaZerados.slice(0, 3).join(', ');
}

function renderCategorias() {
  const atual = el.filtroCategoria.value;
  const cats = categoriasDe(estado.produtos);
  el.filtroCategoria.innerHTML = '<option value="">Todas as categorias</option>' +
    cats.map((c) => `<option${c === atual ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('');
  el.sugestoes.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderTabela() {
  const lista = produtosFiltrados();
  el.corpo.innerHTML = lista.map((p) => {
    const sit = situacaoDo(p);
    return `<tr>
      <td class="prod">${escapeHtml(p.nome)}${p.descricao ? `<small>${escapeHtml(p.descricao)}</small>` : ''}</td>
      <td>${escapeHtml(p.categoria || '—')}</td>
      <td class="num"><strong>${p.quantidade}</strong></td>
      <td class="num">${p.estoqueMinimo}</td>
      <td class="num">${formatarMoeda(p.preco || 0)}</td>
      <td class="num">${formatarMoeda((p.quantidade || 0) * (p.preco || 0))}</td>
      <td><span class="situacao ${sit}">${SITUACAO_ROTULO[sit]}</span></td>
      <td class="acoes-col"><div class="acoes">
        <button class="btn btn-mini btn-entrada" data-mov="entrada" data-id="${p.id}" title="Registrar entrada">+ Entrada</button>
        <button class="btn btn-mini btn-saida" data-mov="saida" data-id="${p.id}" title="Registrar saída">− Saída</button>
        <button class="btn btn-mini" data-editar="${p.id}" title="Editar">Editar</button>
        <button class="btn btn-mini btn-danger" data-excluir="${p.id}" title="Excluir">Excluir</button>
      </div></td>
    </tr>`;
  }).join('');
  el.tabelaVazia.hidden = lista.length > 0;
  if (lista.length === 0) {
    el.vazioDica.textContent = estado.produtos.length === 0
      ? 'Cadastre o primeiro produto com o botão “Novo produto”.'
      : 'Nenhum produto corresponde aos filtros atuais.';
  }
}

function renderHistorico() {
  el.historico.innerHTML = estado.movimentos.slice(0, 30).map((m) => {
    const data = m.criadoEm?.toDate ? m.criadoEm.toDate() : null;
    return `<li>
      <span class="tipo ${m.tipo}">${m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
      <span>${m.quantidade} × ${escapeHtml(m.produtoNome)}${m.motivo ? ` — ${escapeHtml(m.motivo)}` : ''}</span>
      <span class="quando">${data ? data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
    </li>`;
  }).join('');
  el.historicoVazio.hidden = estado.movimentos.length > 0;
}

function render() {
  renderDashboard();
  renderCategorias();
  renderTabela();
  renderHistorico();
}

// ---------- dados ----------

async function iniciar() {
  try {
    estado.uid = await iniciarAutenticacao();
    ouvirDados(estado.uid, {
      aoReceberProdutos(produtos) {
        estado.produtos = produtos;
        render();
      },
      aoReceberMovimentos(movimentos) {
        estado.movimentos = movimentos;
        render();
      },
      aoErro(err) {
        console.error(err);
        toast('Falha ao sincronizar dados. Recarregue a página.', true);
      },
    });
    el.loading.hidden = true;
    el.app.hidden = false;
  } catch (e) {
    el.loading.textContent = 'Não foi possível conectar. Verifique sua conexão e recarregue.';
    console.error(e);
  }
}

// ---------- produto (criar/editar) ----------

function abrirModalProduto(produto = null) {
  estado.produtoEditando = produto;
  el.formProduto.reset();
  el.formErro.hidden = true;
  el.modalProdutoTitulo.textContent = produto ? 'Editar produto' : 'Novo produto';
  if (produto) {
    el.formProduto.nome.value = produto.nome;
    el.formProduto.categoria.value = produto.categoria || '';
    el.formProduto.quantidade.value = produto.quantidade;
    el.formProduto.estoqueMinimo.value = produto.estoqueMinimo ?? 0;
    el.formProduto.preco.value = produto.preco ?? 0;
    el.formProduto.descricao.value = produto.descricao || '';
  }
  el.modalProduto.showModal();
}

async function salvarProduto(evento) {
  evento.preventDefault();
  const f = el.formProduto;
  const dados = {
    nome: f.nome.value.trim(),
    categoria: f.categoria.value.trim(),
    descricao: f.descricao.value.trim(),
    quantidade: Number(f.quantidade.value),
    estoqueMinimo: Number(f.estoqueMinimo.value || 0),
    preco: Number(f.preco.value || 0),
  };
  try {
    validarProduto(dados);
    const duplicado = estado.produtos.some(
      (p) => p.nome.toLowerCase() === dados.nome.toLowerCase() && p.id !== estado.produtoEditando?.id,
    );
    if (duplicado) throw new ValidacaoError('Esse produto já está cadastrado.');

    if (estado.produtoEditando) {
      // Edição de dados cadastrais; a quantidade é alterada apenas por movimentação.
      const { nome, categoria, descricao, estoqueMinimo, preco } = dados;
      await atualizarProduto(estado.uid, estado.produtoEditando.id, {
        nome, categoria, descricao, estoqueMinimo, preco,
      });
      toast('Produto atualizado.');
    } else {
      await criarProduto(estado.uid, dados);
      toast('Produto cadastrado.');
    }
    el.modalProduto.close();
  } catch (e) {
    if (e instanceof ValidacaoError || e instanceof QuantidadeInvalidaError) {
      el.formErro.textContent = e.message;
      el.formErro.hidden = false;
    } else {
      console.error(e);
      toast('Falha ao salvar. Tente novamente.', true);
    }
  }
}

// ---------- movimentações ----------

function abrirModalMovimento(tipo, produto) {
  estado.movimento = { produto, tipo };
  el.formMovimento.reset();
  el.movErro.hidden = true;
  el.modalMovimentoTitulo.textContent = tipo === 'entrada' ? 'Registrar entrada' : 'Registrar saída';
  el.movProduto.innerHTML = `Produto: <strong>${escapeHtml(produto.nome)}</strong> · em estoque: <strong>${produto.quantidade}</strong>`;
  el.btnConfirmarMovimento.textContent = tipo === 'entrada' ? 'Confirmar entrada' : 'Confirmar saída';
  el.modalMovimento.showModal();
}

async function confirmarMovimento(evento) {
  evento.preventDefault();
  const { produto, tipo } = estado.movimento;
  const quantidade = Number(el.formMovimento.quantidade.value);
  const motivo = el.formMovimento.motivo.value;
  try {
    const novaQuantidade = aplicarMovimentacao(produto.quantidade, tipo, quantidade);
    // revalida com o valor mais recente do snapshot para evitar corrida
    const atual = estado.produtos.find((p) => p.id === produto.id);
    if (atual && atual.quantidade !== produto.quantidade) {
      aplicarMovimentacao(atual.quantidade, tipo, quantidade);
      produto.quantidade = atual.quantidade;
    }
    await registrarMovimentacao(estado.uid, produto, tipo, quantidade, motivo, novaQuantidade);
    el.modalMovimento.close();
    toast(descreverMovimentacao({ tipo, produtoNome: produto.nome, quantidade, motivo }));
  } catch (e) {
    if (e instanceof QuantidadeInvalidaError || e instanceof EstoqueInsuficienteError || e instanceof ValidacaoError) {
      el.movErro.textContent = e.message;
      el.movErro.hidden = false;
    } else {
      console.error(e);
      toast('Falha ao registrar movimentação.', true);
    }
  }
}

// ---------- exclusão ----------

function abrirModalExcluir(produto) {
  estado.exclusao = produto;
  el.excluirTexto.innerHTML =
    `Excluir <strong>${escapeHtml(produto.nome)}</strong>? ` +
    (produto.quantidade > 0
      ? `Há <strong>${produto.quantidade}</strong> unidade(s) em estoque. `
      : '') +
    'O histórico de movimentações será mantido.';
  el.modalExcluir.showModal();
}

async function confirmarExcluir(evento) {
  evento.preventDefault();
  try {
    await excluirProduto(estado.uid, estado.exclusao.id);
    el.modalExcluir.close();
    toast(`Produto “${estado.exclusao.nome}” excluído. Histórico mantido.`);
  } catch (e) {
    console.error(e);
    toast('Falha ao excluir.', true);
  }
}

// ---------- eventos ----------

$('btn-novo-produto').addEventListener('click', () => abrirModalProduto());
el.formProduto.addEventListener('submit', salvarProduto);
el.formMovimento.addEventListener('submit', confirmarMovimento);
el.formExcluir.addEventListener('submit', confirmarExcluir);

el.corpo.addEventListener('click', (e) => {
  const mov = e.target.closest('[data-mov]');
  if (mov) {
    const produto = estado.produtos.find((p) => p.id === mov.dataset.id);
    if (produto) abrirModalMovimento(mov.dataset.mov, produto);
    return;
  }
  const editar = e.target.closest('[data-editar]');
  if (editar) {
    const produto = estado.produtos.find((p) => p.id === editar.dataset.editar);
    if (produto) abrirModalProduto(produto);
    return;
  }
  const excluir = e.target.closest('[data-excluir]');
  if (excluir) {
    const produto = estado.produtos.find((p) => p.id === excluir.dataset.excluir);
    if (produto) abrirModalExcluir(produto);
  }
});

for (const f of [el.busca, el.filtroCategoria, el.filtroSituacao]) {
  f.addEventListener('input', renderTabela);
}

document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', (e) => e.target.closest('dialog').close()));

iniciar();
