// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./src/routes/auth.routes");
const produtosRoutes = require("./src/routes/produtos.routes");
const movimentacoesRoutes = require("./src/routes/movimentacoes.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");
const alertasRoutes = require("./src/routes/alertas.routes");
const usuariosRoutes = require("./src/routes/usuarios.routes");
const fornecedoresRoutes = require("./src/routes/fornecedores.routes");
const auditoriaRoutes = require("./src/routes/auditoria.routes");
const db = require("./src/config/db");
const fs = require("fs");

// Em hospedagens sem acesso a terminal (Render, Railway etc), garante que o
// banco inicial (usuários + produtos de exemplo) exista no primeiro boot.
if (!fs.existsSync(db.DB_FILE)) {
  console.log("Nenhum banco de dados encontrado — criando dados iniciais (seed)...");
  require("./src/data/seed");
}

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// Limite geral de requisições por IP (proteção adicional contra abuso da API)
app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.use("/api/auth", authRoutes);
app.use("/api/produtos", produtosRoutes);
app.use("/api/movimentacoes", movimentacoesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alertas", alertasRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/fornecedores", fornecedoresRoutes);
app.use("/api/auditoria", auditoriaRoutes);

app.get("/api/status", (req, res) => {
  res.json({ status: "online", horario: new Date().toISOString() });
});

// Backup manual sob demanda (o agendamento automático fica no README/cron)
app.post("/api/backup", (req, res) => {
  const caminho = db.backup();
  res.json({ mensagem: "Backup criado.", caminho });
});

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`NORTA WMS backend rodando em http://localhost:${PORT}`);
});
