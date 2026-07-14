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
    fornecedores: [],
    movimentacoes: [],
    notasFiscais: [],
    producoes: [],
    logs: [],
    empresa: {
      razaoSocial: "Modelo Equipamentos Avícolas Ltda",
      nomeFantasia: "Modelo Equipamentos Avícolas",
      cnpj: "",
      ie: "",
      im: "",
      cnae: "2813900",
      regimeTributario: "3",
      endereco: "",
      numero: "",
      bairro: "",
      cep: "",
      codMunicipio: "",
      municipio: "",
      uf: "SP",
      fone: "",
      email: ""
    },
    contadores: { produto: 0, movimentacao: 0, usuario: 0, log: 0, fornecedor: 0, notaFiscal: 0, producao: 0 }
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData(), null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const data = JSON.parse(raw);

  // Compatibilidade com bancos criados antes de entidades mais recentes existirem
  if (!data.fornecedores) data.fornecedores = [];
  if (!data.contadores.fornecedor) data.contadores.fornecedor = 0;
  if (!data.notasFiscais) data.notasFiscais = [];
  if (!data.contadores.notaFiscal) data.contadores.notaFiscal = 0;
  if (!data.producoes) data.producoes = [];
  if (!data.contadores.producao) data.contadores.producao = 0;
  if (!data.empresa) data.empresa = defaultData().empresa;

  return data;
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
