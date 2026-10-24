# Sistema de Estoque em Python (e na web)

Sistema de gerenciamento de estoque desenvolvido em Python com foco na prática de lógica de programação, organização de código e orientação a objetos. Desde 2026, o repositório também inclui uma versão web construída sobre as mesmas regras de negócio.

## Contexto

Este foi um dos meus primeiros projetos da faculdade de Ciência da Computação, conservado como parte da evolução do meu portfólio: um sistema de terminal completo, com orientação a objetos, validações e regras de controle de estoque, tudo na biblioteca padrão do Python. A versão web foi criada depois como exercício de evolução: mesmo domínio, mesmas regras, mas com persistência real, interface gráfica e histórico de movimentações. A versão original permanece intacta no repositório.

## Evolução: original → web

| | Original (Python/CLI) | Web |
|---|---|---|
| Interface | terminal | dashboard responsivo (desktop e mobile) |
| Persistência | lista em memória (perde ao fechar) | Firestore (dados reais, em tempo real) |
| Histórico | Não disponível | movimentações completas com data/hora e motivo |
| Estoque mínimo | Não disponível | alerta de estoque baixo e zerado |
| Edição/exclusão | Não disponível | com confirmação e histórico preservado |
| Filtros | busca exata por nome | busca por nome + filtro por categoria e situação |
| Testes | manuais | 33 testes automatizados (`node --test`) |
| Demo | `python main.py` | https://oenzoa-estoque.web.app |

## Funcionalidades (web)

- Cadastro, edição, visualização e exclusão de produtos (com confirmação).
- Nome, descrição opcional, categoria, quantidade, estoque mínimo e preço.
- Entrada e saída de estoque com quantidade, data/hora e motivo.
- Histórico completo de movimentações.
- Dashboard: total de produtos, itens em estoque, valor em estoque, produtos com estoque baixo e sem estoque, movimentações recentes.
- Busca por nome. Filtros por categoria e por situação (normal, estoque baixo, sem estoque).
- Destaques visuais para estoque baixo e zerado.

## Regras de negócio

Herdadas do original e mantidas na web:

Toda movimentação exige quantidade inteira maior que zero.

Saída nunca pode exceder o estoque: o estoque não fica negativo.

Não há produto com nome duplicado.

Quantidade, estoque mínimo e preço não podem ser negativos.

Valor em estoque = quantidade × preço.

Regras novas da versão web:

A quantidade do produto só muda por movimentação: a edição de cadastro não altera estoque, preservando a coerência do histórico.

Toda entrada/saída gera um registro permanente no histórico (imutável: as regras do Firestore proíbem edição e exclusão de movimentações).

Excluir um produto mantém o histórico (o nome fica denormalizado no registro da movimentação).

## Stack e arquitetura

**Original:** Python 3 (somente biblioteca padrão), interface de terminal.

**Web:** HTML, CSS e JavaScript puros (sem frameworks), Firebase Hosting, Cloud Firestore e Firebase Authentication (anônima).

```
web/
├── model.js       # motor puro: validações, movimentações, filtros, dashboard
├── firestore.js   # camada de acesso ao Firestore
├── app.js         # interface
├── index.html
└── style.css
tests/model.test.mjs
firestore.rules    # regras de segurança do Firestore
```

## Modelo de dados (Firestore)

Cada visitante da demo recebe uma autenticação anônima e um estoque próprio e isolado:

```
users/{uid}/products/{id}
  nome: string (1–120)
  descricao: string (opcional, até 500)
  categoria: string (até 60)
  quantidade: inteiro >= 0
  estoqueMinimo: inteiro >= 0
  preco: número >= 0
  criadoEm / atualizadoEm: Timestamp

users/{uid}/movements/{id}
  produtoId: string
  produtoNome: string (denormalizado, histórico sobrevive à exclusão)
  tipo: "entrada" | "saida"
  quantidade: inteiro > 0
  motivo: string (opcional, até 300)
  criadoEm: Timestamp
```

### Segurança (`firestore.rules`)

Todo documento fica sob `users/{uid}` e só é acessível com `request.auth.uid == uid`.

Campos são validados nas regras (tipos, limites, não-negatividade).

Movimentações são somente criáveis: `update` e `delete` são negados.

## Como executar

### Versão original (Python)

```bash
git clone https://github.com/oenzoalmeida/sistema-estoque-python.git
cd sistema-estoque-python
python main.py
```

### Versão web localmente

```bash
# sirva a pasta web/ com qualquer servidor estático, por exemplo:
npx http-server web -p 8080
# abra http://localhost:8080
```

Sem credenciais locais do Firebase, a aplicação conecta no projeto de demonstração publicado.

## Testes

```bash
node --test tests/model.test.mjs
```

Cobrem cadastro e validações, entrada, saída, tentativa de estoque negativo, situações (normal/baixo/zerado), descrição do histórico, busca, filtros, categorias e agregações do dashboard.

## Deploy

Manual via GitHub Actions (`.github/workflows/deploy-firebase.yml`), com autenticação keyless por Workload Identity Federation. Nenhuma chave de service account é armazenada. Publica o Hosting no projeto `oenzoa-estoque`. As regras do Firestore ficam versionadas em `firestore.rules` e são publicadas com `npx firebase-tools deploy --only firestore:rules --project oenzoa-estoque`.

## Demo

**https://oenzoa-estoque.web.app**

Abertura direta, sem login. Cada navegador recebe um estoque de demonstração isolado.

## Autor

Enzo Almeida
