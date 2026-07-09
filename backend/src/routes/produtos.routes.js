// src/routes/produtos.routes.js
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

function calcularStatus(p) {
  const hoje = new Date();
  if (p.validade) {
    const dataValidade = new Date(p.validade);
    if (dataValidade < hoje) return "vencido";
  }
  if (p.quantidade <= 0) return "falta";
  if (p.quantidade < p.estoqueMinimo) return "critico";
  if (p.estoqueMaximo && p.quantidade > p.estoqueMaximo) return "excesso";
  if (p.validade) {
    const dias = (new Date(p.validade) - hoje) / 86400000;
    if (dias <= 30) return "vence_em_breve";
  }
  return "saudavel";
}

// ---------- Listar (com busca/filtros) ----------
router.get("/", (req, res) => {
  const { busca, categoria, setor, status, fornecedorId } = req.query;
  const data = db.load();
  let produtos = data.produtos.map(p => ({ ...p, status: calcularStatus(p) }));

  if (busca) {
    const q = normalizar(busca);
    produtos = produtos.filter(p =>
      normalizar(p.nome).includes(q) ||
      normalizar(p.codigoInterno).includes(q) ||
      normalizar(p.codigoBarras || "").includes(q) ||
      normalizar(p.lote || "").includes(q) ||
      normalizar(p.fabricante || "").includes(q) ||
      normalizar(p.fornecedor || "").includes(q)
    );
  }
  if (categoria) produtos = produtos.filter(p => p.categoria === categoria);
  if (setor) produtos = produtos.filter(p => p.setor === setor);
  if (status) produtos = produtos.filter(p => p.status === status);
  if (fornecedorId) produtos = produtos.filter(p => p.fornecedorId === parseInt(fornecedorId, 10));

  res.json(produtos);
});

router.get("/:id", (req, res) => {
  const data = db.load();
  const produto = data.produtos.find(p => p.id === parseInt(req.params.id, 10));
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado." });
  res.json({ ...produto, status: calcularStatus(produto) });
});

// ---------- Criar ----------
router.post("/", authorize("administrador", "supervisor", "almoxarife"), (req, res) => {
  const body = req.body;
  if (!body.nome || !body.codigoInterno) {
    return res.status(400).json({ erro: "Nome e código interno são obrigatórios." });
  }
  if (!body.fornecedorId) {
    return res.status(400).json({ erro: "Selecione o fornecedor do produto." });
  }

  const data = db.load();
  const existeCodigo = data.produtos.some(p => p.codigoInterno === body.codigoInterno);
  if (existeCodigo) return res.status(409).json({ erro: "Já existe um produto com este código interno." });

  const fornecedor = data.fornecedores.find(f => f.id === parseInt(body.fornecedorId, 10));
  if (!fornecedor) return res.status(400).json({ erro: "Fornecedor não encontrado." });

  data.contadores.produto += 1;
  const novo = {
    id: data.contadores.produto,
    codigoInterno: body.codigoInterno,
    codigoBarras: body.codigoBarras || null,
    qrCode: body.qrCode || null,
    nome: body.nome,
    categoria: body.categoria || "geral",
    fabricante: body.fabricante || null,
    fornecedorId: fornecedor.id,
    fornecedor: fornecedor.nome,
    unidadeMedida: body.unidadeMedida || "un",
    localizacao: body.localizacao || null, // ex: R03-CA-P12
    lote: body.lote || null,
    numeroSerie: body.numeroSerie || null,
    dataFabricacao: body.dataFabricacao || null,
    validade: body.validade || null,
    peso: body.peso || null,
    dimensoes: body.dimensoes || null,
    setor: body.setor || "almoxarifado_central",
    quantidade: Number(body.quantidade || 0),
    estoqueMinimo: Number(body.estoqueMinimo || 0),
    estoqueMaximo: body.estoqueMaximo ? Number(body.estoqueMaximo) : null,
    valorUnitario: Number(body.valorUnitario || 0),
    foto: body.foto || null,
    criadoEm: new Date().toISOString()
  };
  data.produtos.push(novo);
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "CRIAR_PRODUTO", entidade: "produto", entidadeId: novo.id });
  res.status(201).json(novo);
});

// ---------- Atualizar ----------
router.put("/:id", authorize("administrador", "supervisor", "almoxarife"), (req, res) => {
  const data = db.load();
  const idx = data.produtos.findIndex(p => p.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ erro: "Produto não encontrado." });

  const body = { ...req.body };
  if (body.fornecedorId) {
    const fornecedor = data.fornecedores.find(f => f.id === parseInt(body.fornecedorId, 10));
    if (!fornecedor) return res.status(400).json({ erro: "Fornecedor não encontrado." });
    body.fornecedorId = fornecedor.id;
    body.fornecedor = fornecedor.nome;
  }

  data.produtos[idx] = { ...data.produtos[idx], ...body, id: data.produtos[idx].id };
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "ATUALIZAR_PRODUTO", entidade: "produto", entidadeId: data.produtos[idx].id });
  res.json(data.produtos[idx]);
});

// ---------- Remover ----------
router.delete("/:id", authorize("administrador", "supervisor"), (req, res) => {
  const data = db.load();
  const idx = data.produtos.findIndex(p => p.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ erro: "Produto não encontrado." });

  const removido = data.produtos.splice(idx, 1)[0];
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "REMOVER_PRODUTO", entidade: "produto", entidadeId: removido.id });
  res.json({ mensagem: "Produto removido." });
});

module.exports = router;
module.exports.calcularStatus = calcularStatus;
