//src/routes/fornecedor.routes.js
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { registrarLog } = require("../utils/audit");

const router = express.Router();
router.use(authenticate);

function sanitizar(f) {
  const { ...resto } = f;
  return resto;
}

// ---------- Listar fornecedores ----------
router.get("/", authorize("administrador"), (req, res) => {
  const data = db.load();
  res.json(data.fornecedores.map(sanitizar));
});

// ---------- Criar fornecedor ----------
router.post("/", authorize("administrador"), (req, res) => {
  const { nome, cnpj, telefone, email, endereco } = req.body;
  const novoFornecedor = { nome, cnpj, telefone, email, endereco };
  const data = db.load();
  data.fornecedores.push(novoFornecedor);
  db.save(data);
  registrarLog(req.user.id, "fornecedor", "create", novoFornecedor);
  res.status(201).json(sanitizar(novoFornecedor));
});

// ---------- Atualizar fornecedor ----------
router.put("/:id", authorize("administrador"), (req, res) => {
  const { id } = req.params;
  const { nome, cnpj, telefone, email, endereco } = req.body;
  const data = db.load();
  const index = data.fornecedores.findIndex((f) => f.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Fornecedor não encontrado" });
  }
  data.fornecedores[index] = { ...data.fornecedores[index], nome, cnpj, telefone, email, endereco };
  db.save(data);
  registrarLog(req.user.id, "fornecedor", "update", data.fornecedores[index]);
  res.json(sanitizar(data.fornecedores[index]));
});

// ---------- Deletar fornecedor ----------
router.delete("/:id", authorize("administrador"), (req, res) => {
  const { id } = req.params;
  const data = db.load();
  const index = data.fornecedores.findIndex((f) => f.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Fornecedor não encontrado" });
  }
  const fornecedorRemovido = data.fornecedores.splice(index, 1)[0];
  db.save(data);
  registrarLog(req.user.id, "fornecedor", "delete", fornecedorRemovido);
  res.json(sanitizar(fornecedorRemovido));
});

// 

module.exports = router;