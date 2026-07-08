// src/config/db.js
// Camada de persistência simples baseada em arquivo JSON.
// Objetivo: rodar em qualquer máquina sem instalar Postgres/MySQL nem
// compilar dependências nativas. Para produção real, trocar por
// PostgreSQL/MySQL (a estrutura de "tabelas" abaixo já reflete o
// modelo relacional pretendido, facilitando a migração futura).

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");

function defaultData() {
  return {
    usuarios: [],
    produtos: [],
    movimentacoes: [],
    logs: [],
    contadores: { produto: 0, movimentacao: 0, usuario: 0, log: 0 }
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData(), null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw);
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Backup automático: copia o arquivo atual com timestamp.
function backup() {
  const backupDir = path.join(__dirname, "..", "data", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `db-${stamp}.json`);
  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, dest);
  }
  return dest;
}

module.exports = { load, save, backup, DB_FILE };
