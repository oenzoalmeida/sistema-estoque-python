"""Testes das regras de estoque da versão Python.

Até aqui o CI só rodava compileall. Não dava para fazer mais do que isso:
main.py terminava com uma chamada solta a menu(), então importar o módulo
abria o menu interativo e travava no input(). A guarda __main__ resolveu isso
e é o que torna estes testes possíveis.

Os casos de movimentação vêm de tests/casos-movimentacao.json, a mesma tabela
lida pela suíte da versão web.
"""

import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import Produto, buscar_produto, produtos  # noqa: E402

CASOS = json.loads(
    (Path(__file__).resolve().parent / 'casos-movimentacao.json').read_text('utf-8')
)


def movimentar(produto, tipo, quantidade):
    """Aplica a movimentação silenciando o print da camada de terminal."""
    with redirect_stdout(io.StringIO()) as saida:
        if tipo == 'entrada':
            resultado = produto.atualizar_estoque(quantidade)
        else:
            resultado = produto.remover_estoque(quantidade)
    return resultado, saida.getvalue()


def novo_produto(quantidade=10, preco=100.0):
    return Produto('Teste', 'Categoria', quantidade, preco)


class TabelaCompartilhadaTests(unittest.TestCase):
    """Roda a tabela de casos que a versão web também usa."""

    def test_a_tabela_tem_casos(self):
        self.assertGreater(len(CASOS['movimentacoes']), 8)

    def test_movimentacoes_validas(self):
        for caso in CASOS['movimentacoes']:
            if 'erro' in caso:
                continue
            with self.subTest(caso=f"{caso['atual']} {caso['tipo']} {caso['quantidade']}"):
                produto = novo_produto(caso['atual'])
                movimentar(produto, caso['tipo'], caso['quantidade'])
                self.assertEqual(produto.quantidade, caso['esperado'])

    def test_movimentacoes_recusadas_nao_alteram_a_quantidade(self):
        for caso in CASOS['movimentacoes']:
            if 'erro' not in caso:
                continue
            with self.subTest(caso=f"{caso['atual']} {caso['tipo']} {caso['quantidade']}"):
                produto = novo_produto(caso['atual'])
                movimentar(produto, caso['tipo'], caso['quantidade'])
                self.assertEqual(produto.quantidade, caso['atual'])


class AtualizarEstoqueTests(unittest.TestCase):
    def test_soma_a_quantidade(self):
        produto = novo_produto(10)
        movimentar(produto, 'entrada', 5)
        self.assertEqual(produto.quantidade, 15)

    def test_recusa_zero(self):
        produto = novo_produto(10)
        _, mensagem = movimentar(produto, 'entrada', 0)
        self.assertEqual(produto.quantidade, 10)
        self.assertIn('maior que zero', mensagem)

    def test_recusa_negativo(self):
        produto = novo_produto(10)
        movimentar(produto, 'entrada', -3)
        self.assertEqual(produto.quantidade, 10)


class RemoverEstoqueTests(unittest.TestCase):
    def test_subtrai_a_quantidade_e_confirma(self):
        produto = novo_produto(10)
        resultado, _ = movimentar(produto, 'saida', 4)
        self.assertTrue(resultado)
        self.assertEqual(produto.quantidade, 6)

    def test_pode_zerar_o_estoque(self):
        produto = novo_produto(10)
        resultado, _ = movimentar(produto, 'saida', 10)
        self.assertTrue(resultado)
        self.assertEqual(produto.quantidade, 0)

    def test_recusa_acima_do_disponivel(self):
        produto = novo_produto(5)
        resultado, mensagem = movimentar(produto, 'saida', 6)
        self.assertFalse(resultado)
        self.assertEqual(produto.quantidade, 5)
        self.assertIn('insuficiente', mensagem.lower())

    def test_recusa_zero_e_negativo(self):
        for quantidade in (0, -1):
            with self.subTest(quantidade=quantidade):
                produto = novo_produto(5)
                resultado, _ = movimentar(produto, 'saida', quantidade)
                self.assertFalse(resultado)
                self.assertEqual(produto.quantidade, 5)


class ValorTotalTests(unittest.TestCase):
    def test_multiplica_quantidade_por_preco(self):
        self.assertAlmostEqual(Produto('x', 'y', 3, 10.5).valor_total(), 31.5)

    def test_estoque_zerado_vale_zero(self):
        self.assertEqual(Produto('x', 'y', 0, 99.9).valor_total(), 0)

    def test_acompanha_a_movimentacao(self):
        produto = novo_produto(10, 2.0)
        self.assertEqual(produto.valor_total(), 20)
        movimentar(produto, 'saida', 5)
        self.assertEqual(produto.valor_total(), 10)


class BuscarProdutoTests(unittest.TestCase):
    def test_encontra_pelo_nome_exato(self):
        self.assertIsNotNone(buscar_produto('Mouse Logitech'))

    def test_ignora_maiusculas_e_minusculas(self):
        self.assertIsNotNone(buscar_produto('mouse logitech'))
        self.assertIsNotNone(buscar_produto('MOUSE LOGITECH'))

    def test_devolve_none_para_inexistente(self):
        self.assertIsNone(buscar_produto('Produto que não existe'))

    def test_nao_faz_busca_parcial(self):
        # 'Mouse' não encontra 'Mouse Logitech': a comparação é por igualdade.
        # Fixado como comportamento conhecido, não como preferência.
        self.assertIsNone(buscar_produto('Mouse'))


class CatalogoInicialTests(unittest.TestCase):
    def test_importar_o_modulo_nao_abre_o_menu(self):
        # Regressão: main.py chamava menu() no nível do módulo, então qualquer
        # import travava no input(). Se este arquivo rodou, a guarda está lá.
        self.assertTrue(produtos)

    def test_catalogo_vem_com_produtos_validos(self):
        for produto in produtos:
            with self.subTest(produto=produto.nome):
                self.assertGreaterEqual(produto.quantidade, 0)
                self.assertGreater(produto.preco, 0)


if __name__ == '__main__':
    unittest.main()
