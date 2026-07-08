# NORTA WMS — Sistema de gestão de almoxarifado

Sistema completo (backend + frontend) para controle de estoque industrial:
login com segurança real (bcrypt, JWT, 2FA opcional, bloqueio por tentativas),
controle de acesso por papel, cadastro de produtos, movimentações de estoque,
alertas automáticos, dashboard com KPIs e log de auditoria.

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
└── frontend/
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

Abra **um segundo terminal**, agora na pasta `frontend`:

```bash
cd almoxarifado-sistema/frontend
python3 -m http.server 8080
```

(Se não tiver Python, qualquer servidor estático funciona — por exemplo
`npx serve .` também funciona dentro da pasta `frontend`.)

## Passo 7 — Acesse o sistema

Abra o navegador em **http://localhost:8080** e faça login com qualquer
usuário da tabela acima.

---

## O que já está funcionando de verdade

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
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js                 → chamadas à API (fetch + JWT)
        └── app.js                 → login, navegação e telas
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
