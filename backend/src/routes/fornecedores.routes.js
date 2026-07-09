// src/routes/fornecedores.routes.js
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { registrarLog } = require("../utils/audit");

const router = express.Router();
router.use(authenticate);

function normalizar(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ---------- Listar (com busca) ----------
router.get("/", (req, res) => {
  const { busca } = req.query;
  const data = db.load();
  let fornecedores = [...data.fornecedores];

  if (busca) {
    const q = normalizar(busca);
    fornecedores = fornecedores.filter(f =>
      normalizar(f.nome).includes(q) ||
      normalizar(f.cnpj || "").includes(q) ||
      normalizar(f.contato || "").includes(q) ||
      normalizar(f.categoria || "").includes(q)
    );
  }

  // conta quantos produtos cada fornecedor atende
  const produtos = data.produtos;
  fornecedores = fornecedores.map(f => ({
    ...f,
    totalProdutos: produtos.filter(p => p.fornecedorId === f.id).length
  }));

  res.json(fornecedores);
});

router.get("/:id", (req, res) => {
  const data = db.load();
  const fornecedor = data.fornecedores.find(f => f.id === parseInt(req.params.id, 10));
  if (!fornecedor) return res.status(404).json({ erro: "Fornecedor não encontrado." });
  const produtos = data.produtos.filter(p => p.fornecedorId === fornecedor.id);
  res.json({ ...fornecedor, produtos });
});

// ---------- Criar ----------
router.post("/", authorize("administrador", "supervisor", "compras"), (req, res) => {
  const { nome, cnpj, contato, telefone, email, endereco, categoria, observacoes } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome do fornecedor é obrigatório." });

  const data = db.load();
  data.contadores.fornecedor += 1;
  const novo = {
    id: data.contadores.fornecedor,
    nome,
    cnpj: cnpj || null,
    contato: contato || null,
    telefone: telefone || null,
    email: email || null,
    endereco: endereco || null,
    categoria: categoria || null,
    observacoes: observacoes || null,
    criadoEm: new Date().toISOString()
  };
  data.fornecedores.push(novo);
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "CRIAR_FORNECEDOR", entidade: "fornecedor", entidadeId: novo.id });
  res.status(201).json(novo);
});

// ---------- Atualizar ----------
router.put("/:id", authorize("administrador", "supervisor", "compras"), (req, res) => {
  const data = db.load();
  const idx = data.fornecedores.findIndex(f => f.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ erro: "Fornecedor não encontrado." });

  data.fornecedores[idx] = { ...data.fornecedores[idx], ...req.body, id: data.fornecedores[idx].id };
  db.save(data);

  // mantém o nome do fornecedor sincronizado nos produtos vinculados
  const fornecedorAtualizado = data.fornecedores[idx];
  data.produtos.forEach(p => {
    if (p.fornecedorId === fornecedorAtualizado.id) p.fornecedor = fornecedorAtualizado.nome;
  });
  db.save(data);

  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "ATUALIZAR_FORNECEDOR", entidade: "fornecedor", entidadeId: fornecedorAtualizado.id });
  res.json(fornecedorAtualizado);
});

// ---------- Remover ----------
router.delete("/:id", authorize("administrador", "supervisor"), (req, res) => {
  const data = db.load();
  const idx = data.fornecedores.findIndex(f => f.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ erro: "Fornecedor não encontrado." });

  const emUso = data.produtos.some(p => p.fornecedorId === data.fornecedores[idx].id);
  if (emUso) {
    return res.status(400).json({ erro: "Este fornecedor está vinculado a produtos cadastrados. Remova ou reatribua os produtos antes de excluir." });
  }

  const removido = data.fornecedores.splice(idx, 1)[0];
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "REMOVER_FORNECEDOR", entidade: "fornecedor", entidadeId: removido.id });
  res.json({ mensagem: "Fornecedor removido." });
});

module.exports = router;
