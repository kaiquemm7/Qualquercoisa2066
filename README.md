# MODELO — Sistema de gestão de almoxarifado

Sistema completo (backend + frontend) para controle de estoque industrial da
**Modelo Equipamentos Avícolas**: login com segurança real (bcrypt, JWT, 2FA
opcional, bloqueio por tentativas), controle de acesso por papel, cadastro de
produtos, movimentações de estoque, alertas automáticos, dashboard com KPIs e
log de auditoria.

## O que você vai precisar

- **Node.js 18 ou superior** instalado no seu computador.
  Verifique com: `node -v`
  Se não tiver, baixe em https://nodejs.org (escolha a versão LTS).

Não é necessário instalar banco de dados separado — o sistema usa um arquivo
JSON local (`backend/src/data/db.json`) como banco de dados no modo atual,
para você conseguir rodar tudo sem configurar Postgres/MySQL. A estrutura de
dados já foi desenhada para migrar depois (veja a seção "Próximos passos").

---

## Passo 1 — Baixe e extraia a pasta

Extraia o arquivo `.zip` em qualquer lugar do seu computador. Você deve ver:

```
almoxarifado-sistema/
├── backend/
└── docs/
```

## Passo 2 — Instale as dependências do backend

Abra um terminal **dentro da pasta `backend`**:

```bash
cd almoxarifado-sistema/backend
npm install
```

Isso vai baixar as bibliotecas usadas (Express, bcrypt, JWT, etc). Pode levar
um ou dois minutos.

## Passo 3 — Configure as variáveis de ambiente

Ainda dentro de `backend`, copie o arquivo de exemplo:

```bash
cp .env.example .env
```

(No Windows, se `cp` não funcionar, copie e renomeie `.env.example` para
`.env` manualmente pelo explorador de arquivos.)

Abra o `.env` e, se quiser, troque o valor de `JWT_SECRET` por qualquer texto
longo e aleatório — isso é o que garante a segurança dos tokens de login.

## Passo 4 — Crie os dados iniciais (seed)

```bash
npm run seed
```

Isso cria o banco de dados com 6 usuários de teste (um para cada papel do
sistema) e 8 produtos de exemplo. Os usuários criados são:

| Usuário         | Senha           | Papel          |
|-----------------|-----------------|----------------|
| admin           | Admin@123       | Administrador  |
| carlos.mendes   | Almox@123       | Almoxarife     |
| julia.alves     | Superv@123      | Supervisor     |
| paulo.souza     | Compras@123     | Compras        |
| marina.torres   | Producao@123    | Produção       |
| roberto.lima    | Auditor@123     | Auditor        |

> Troque essas senhas antes de usar o sistema com dados reais.

## Passo 5 — Suba o backend

```bash
npm start
```

Você deve ver: `NORTA WMS backend rodando em http://localhost:3001`

Deixe esse terminal aberto — é o servidor da API.

## Passo 6 — Suba o frontend

Abra **um segundo terminal**, agora na pasta `docs`:

```bash
cd almoxarifado-sistema/docs
python3 -m http.server 8080
```

(Se não tiver Python, qualquer servidor estático funciona — por exemplo
`npx serve .` também funciona dentro da pasta `docs`.)

## Passo 7 — Acesse o sistema

Abra o navegador em **http://localhost:8080** e faça login com qualquer
usuário da tabela acima.

---

## O que já está funcionando de verdade

- **Produção (ficha técnica / estrutura de produto)** — para produtos que
  são fabricados a partir de outros (ex: um "Coletor" montado com
  rolamentos, disjuntores, parafusos etc), cadastre a **ficha técnica** dele
  na tela Estoque (botão de ícone de lista em cada produto): liste quais
  matérias-primas entram e em que quantidade, por unidade fabricada. Depois,
  na aba **Produção**, é só escolher o produto final e quantas unidades
  você vai fabricar — o sistema calcula sozinho quanto de cada matéria-prima
  vai ser consumido, mostra se o estoque atual é suficiente, e ao confirmar
  dá baixa em cada matéria-prima e entrada no produto final automaticamente,
  tudo registrado como uma ordem de produção rastreável. Se faltar estoque
  de qualquer componente, o sistema bloqueia a produção e mostra exatamente
  o que está faltando, sem mexer em nada.
- **Notas Fiscais** — Administrador, Supervisor, Almoxarife e Compras podem
  lançar notas de compra de duas formas:
  - **Importar XML da NF-e**: envie o arquivo XML da nota (o padrão usado pela
    Receita Federal) e o sistema lê automaticamente o fornecedor, os itens,
    quantidades e valores. Ele tenta casar cada item com um produto já
    cadastrado (por código interno ou código de barras); os que não bateram
    ficam marcados para você vincular a um produto existente ou cadastrar um
    novo, tudo na mesma tela, antes de confirmar.
  - **Lançamento manual**: para notas sem XML (ou compras sem nota formal),
    dá pra montar a nota na mão, item por item.
  Em ambos os casos, ao confirmar, o sistema dá entrada automaticamente na
  quantidade de cada item, cria o fornecedor se ele ainda não existir, cria
  produtos novos quando marcado, e registra uma movimentação de entrada para
  cada item — tudo isso numa transação só, sem precisar repetir o trabalho
  manualmente no Estoque ou em Movimentações depois.
- **Registrar entrada avulsa** — na tela Estoque, um botão "Registrar
  entrada" cobre os casos que não vêm de nota fiscal (devolução, ajuste
  manual etc), simétrico ao "Dar baixa" que já existia para saídas.
- **Setor no cadastro de produto + filtro por setor no Estoque** — cada
  produto agora tem um setor (Almoxarifado central, Produção, Manutenção,
  Escritório ou Ferramentaria), e a tela de Estoque tem um filtro para ver
  só o que pertence a um setor específico — por exemplo, só o material do
  Escritório.

- **Login** com senha criptografada (bcrypt), bloqueio automático após 5
  tentativas erradas (15 min), e emissão de token JWT com expiração.
- **2FA (autenticação em dois fatores)** via app autenticador (Google
  Authenticator, Authy etc) — endpoints prontos em `/api/auth/2fa/gerar` e
  `/api/auth/2fa/confirmar` usando TOTP padrão.
- **Controle de acesso por papel** — cada rota da API verifica o papel do
  usuário (ex: só administrador cria funcionários; só administrador,
  supervisor ou almoxarife cadastram produtos).
- **Log de auditoria** — toda ação relevante (login, login falho,
  movimentação, criação de produto/usuário) é registrada com usuário, data,
  hora e IP.
- **Estoque** — cadastro completo de produtos com localização física, lote,
  validade, categoria, fornecedor etc, e busca por qualquer desses campos.
- **Movimentações** — entrada, saída, transferência, ajuste, devolução e
  empréstimo, todas atualizando a quantidade em estoque automaticamente.
- **Alertas inteligentes** — calculados em tempo real: estoque zerado,
  abaixo do mínimo, acima do máximo, vencido, ou vencendo em até 30 dias.
- **Dashboard** — valor total em estoque, produtos críticos, entradas e
  saídas do mês, ranking de produtos mais usados.
- **Backup manual** — `POST /api/backup` copia o banco atual com timestamp
  para `backend/src/data/backups/`.
- **Gestão de funcionários pela interface** — usuários com papel
  Administrador têm um botão "Novo funcionário" na tela Funcionários, que
  cria o acesso (nome, usuário, senha provisória, cargo/nível, setor)
  diretamente pelo sistema, sem precisar mexer na API.
- **Edição e exclusão de produtos pela interface** — na tela Estoque, cada
  produto tem botões de ação: editar é liberado para Administrador,
  Supervisor e Almoxarife; excluir é liberado apenas para Administrador e
  Supervisor. Quem não tem permissão simplesmente não vê os botões — e o
  backend também bloqueia a chamada, então a regra vale mesmo se alguém
  tentar contornar pela API.
- **Logout explícito** — botão de sair dedicado na barra lateral (ícone ao
  lado do perfil), sem depender de clicar no cartão do usuário.
- **Aba de Fornecedores** — cadastro completo (nome, CNPJ, contato, telefone,
  e-mail, endereço, categoria), com busca por qualquer desses campos
  (inclusive sem acento). Clicar num fornecedor abre o perfil dele mostrando
  todos os produtos vinculados a ele. Editar é liberado para Administrador,
  Supervisor e Compras; excluir é liberado para Administrador e Supervisor —
  e o sistema impede excluir um fornecedor que ainda tem produtos vinculados,
  para não deixar produto "órfão".
- **Cadastro de produto exige fornecedor** — todo produto novo precisa estar
  vinculado a um fornecedor já cadastrado (selecionado por uma lista, não
  digitado à mão). Isso mantém o campo consistente e é o que permite buscar
  produtos por fornecedor. Se ainda não existir nenhum fornecedor cadastrado,
  o sistema avisa e pede para cadastrar um primeiro.

## O que é próxima etapa (não incluído nesta primeira entrega)

Esses itens do escopo original pedem infraestrutura extra (banco relacional
real, serviços de e-mail/SMS, hardware) e ficam para a próxima fase, depois
de você validar esse núcleo:

- Migração do arquivo JSON para PostgreSQL/MySQL (o modelo de dados já está
  pronto para isso — é troca de camada, não de estrutura).
- Envio de alertas por e-mail, WhatsApp ou Telegram.
- Leitura de código de barras/QR Code por câmera ou leitor USB.
- Módulos de Compras (cotação, ordem de compra) e Relatórios (PDF/Excel/CSV)
  — hoje são apenas telas de navegação, sem lógica ainda.
- App Android nativo / modo offline.

## Hospedando por um tempo (backend no Render + frontend no GitHub Pages)

1. Suba o projeto pro GitHub normalmente (`git init`, `git add .`, `git commit`, `git push`).
2. **Backend:** crie conta em render.com → *New → Web Service* → conecte o
   repositório → **Root Directory:** `backend` → **Build Command:**
   `npm install` → **Start Command:** `npm start` → adicione as variáveis do
   `.env.example` em *Environment*. O deploy gera uma URL do tipo
   `https://seu-app.onrender.com`.
3. Edite `docs/js/config.js` e troque a URL de produção por essa URL do
   Render (mantendo o `/api` no final), depois `git push` de novo.
4. **Frontend:** no GitHub, vá em **Settings → Pages → Source** e escolha a
   branch `main` com a pasta **`/docs`** (o GitHub Pages só aceita `/root`
   ou `/docs` — por isso a pasta do frontend já se chama `docs` neste
   projeto). Em alguns minutos o site sobe em
   `https://seu-usuario.github.io/nome-do-repo/`.

> No plano grátis do Render o backend "dorme" após ~15 min sem uso (o
> primeiro acesso depois disso demora uns 30-50s) e o arquivo de dados é
> apagado a cada novo deploy — ótimo para demonstrar por um tempo, não para
> guardar dados permanentes.

## Estrutura de pastas

```
almoxarifado-sistema/
├── backend/
│   ├── server.js                  → ponto de entrada da API
│   ├── src/
│   │   ├── config/db.js           → camada de persistência (arquivo JSON)
│   │   ├── middleware/            → autenticação (JWT) e permissões (papéis)
│   │   ├── routes/                → auth, produtos, movimentações, dashboard,
│   │   │                            alertas, usuários, auditoria
│   │   ├── utils/audit.js         → registrador de logs
│   │   └── data/
│   │       ├── seed.js            → cria usuários e produtos iniciais
│   │       └── db.json            → "banco de dados" (gerado pelo seed)
│   └── .env                       → chave JWT e configurações de segurança
└── docs/                          → frontend (nome "docs" por exigência do
    ├── index.html                   GitHub Pages, que só publica /root ou /docs)
    ├── css/style.css
    ├── img/logo.png
    └── js/
        ├── config.js               → URL da API (troque aqui após o deploy do backend)
        ├── api.js                  → chamadas à API (fetch + JWT)
        └── app.js                  → login, navegação e telas
```

## Testando rapidamente pela API (sem abrir o navegador)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin","senha":"Admin@123"}'
```

A resposta traz um `token` — use-o em qualquer outra rota assim:

```bash
curl http://localhost:3001/api/dashboard -H "Authorization: Bearer SEU_TOKEN_AQUI"
```
