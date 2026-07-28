class Produto:
    def __init__(self, nome, categoria, quantidade, preco):
        self.nome = nome
        self.categoria = categoria
        self.quantidade = quantidade
        self.preco = preco

    def atualizar_estoque(self, quantidade):
        if quantidade > 0:
            self.quantidade += quantidade
        else:
            print("A quantidade precisa ser maior que zero.")

    def remover_estoque(self, quantidade):
        if quantidade <= 0:
            print("A quantidade precisa ser maior que zero.")
            return False

        if quantidade <= self.quantidade:
            self.quantidade -= quantidade
            return True

        print("Estoque insuficiente.")
        return False

    def valor_total(self):
        return self.quantidade * self.preco


produtos = [
    Produto("Notebook Dell", "Informática", 8, 3899.90),
    Produto("Mouse Logitech", "Periféricos", 20, 129.90),
    Produto("Teclado Mecânico", "Periféricos", 12, 279.90),
]


def buscar_produto(nome):
    for produto in produtos:
        if produto.nome.lower() == nome.lower():
            return produto

    return None


def listar_produtos():
    print("\n--- PRODUTOS EM ESTOQUE ---")

    if len(produtos) == 0:
        print("Nenhum produto cadastrado.")
        return

    for produto in produtos:
        print(
            f"{produto.nome} | "
            f"{produto.categoria} | "
            f"Quantidade: {produto.quantidade} | "
            f"Preço: R$ {produto.preco:.2f}"
        )


def cadastrar_produto():
    print("\n--- CADASTRAR PRODUTO ---")

    nome = input("Nome do produto: ")
    categoria = input("Categoria: ")

    if buscar_produto(nome):
        print("Esse produto já está cadastrado.")
        return

    try:
        quantidade = int(input("Quantidade: "))
        preco = float(input("Preço: R$ ").replace(",", "."))
    except ValueError:
        print("Quantidade ou preço inválido.")
        return

    if quantidade < 0 or preco < 0:
        print("Quantidade e preço não podem ser negativos.")
        return

    novo_produto = Produto(nome, categoria, quantidade, preco)
    produtos.append(novo_produto)

    print("Produto cadastrado com sucesso!")


def pesquisar_produto():
    nome = input("\nDigite o nome do produto: ")

    produto = buscar_produto(nome)

    if produto:
        print("\nProduto encontrado:")
        print(f"Nome: {produto.nome}")
        print(f"Categoria: {produto.categoria}")
        print(f"Quantidade: {produto.quantidade}")
        print(f"Preço: R$ {produto.preco:.2f}")
        print(f"Valor em estoque: R$ {produto.valor_total():.2f}")

    else:
        print("Produto não encontrado.")


def entrada_estoque():
    nome = input("\nProduto: ")

    produto = buscar_produto(nome)

    if produto:
        try:
            quantidade = int(input("Quantidade de entrada: "))
        except ValueError:
            print("Quantidade inválida.")
            return

        quantidade_anterior = produto.quantidade
        produto.atualizar_estoque(quantidade)

        if produto.quantidade != quantidade_anterior:
            print("Estoque atualizado com sucesso!")
            print(f"Quantidade atual: {produto.quantidade}")

    else:
        print("Produto não encontrado.")


def saida_estoque():
    nome = input("\nProduto: ")

    produto = buscar_produto(nome)

    if produto:
        try:
            quantidade = int(input("Quantidade de saída: "))
        except ValueError:
            print("Quantidade inválida.")
            return

        if produto.remover_estoque(quantidade):
            print("Saída registrada com sucesso!")
            print(f"Quantidade atual: {produto.quantidade}")

    else:
        print("Produto não encontrado.")


def valor_total_estoque():
    total = 0

    for produto in produtos:
        total += produto.valor_total()

    print(f"\nValor total do estoque: R$ {total:.2f}")


def menu():
    while True:
        print("\n--- SISTEMA DE ESTOQUE ---")
        print("1 - Listar produtos")
        print("2 - Cadastrar produto")
        print("3 - Buscar produto")
        print("4 - Entrada de estoque")
        print("5 - Saída de estoque")
        print("6 - Valor total do estoque")
        print("0 - Sair")

        opcao = input("\nEscolha uma opção: ")

        if opcao == "1":
            listar_produtos()

        elif opcao == "2":
            cadastrar_produto()

        elif opcao == "3":
            pesquisar_produto()

        elif opcao == "4":
            entrada_estoque()

        elif opcao == "5":
            saida_estoque()

        elif opcao == "6":
            valor_total_estoque()

        elif opcao == "0":
            print("\nPrograma encerrado.")
            break

        else:
            print("\nOpção inválida.")


menu()