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
  const { busca, categoria, setor, status, fornecedorId, tipo } = req.query;
  const data = db.load();
  let produtos = data.produtos.map(p => ({ ...p, tipo: p.tipo || "materia_prima", status: calcularStatus(p) }));

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
  if (tipo) produtos = produtos.filter(p => p.tipo === tipo);

  res.json(produtos);
});

router.get("/:id", (req, res) => {
  const data = db.load();
  const produto = data.produtos.find(p => p.id === parseInt(req.params.id, 10));
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado." });
  res.json({ ...produto, tipo: produto.tipo || "materia_prima", status: calcularStatus(produto) });
});

// ---------- Criar (matéria-prima / produto comprado) ----------
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
    tipo: "materia_prima",
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
    componentes: [],
    ncm: body.ncm || "00000000",
    cfopPadrao: body.cfopPadrao || "1102",
    cstIcms: body.cstIcms || "000",
    aliquotaIcms: Number(body.aliquotaIcms || 0),
    cstPis: body.cstPis || "01",
    aliquotaPis: Number(body.aliquotaPis || 1.65),
    cstCofins: body.cstCofins || "01",
    aliquotaCofins: Number(body.aliquotaCofins || 7.6),
    criadoEm: new Date().toISOString()
  };
  data.produtos.push(novo);
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "CRIAR_PRODUTO", entidade: "produto", entidadeId: novo.id });
  res.status(201).json(novo);
});

// ---------- Criar (equipamento final / fabricado internamente) ----------
router.post("/equipamento-final", authorize("administrador", "supervisor", "almoxarife"), (req, res) => {
  const body = req.body;
  if (!body.nome || !body.codigoInterno) {
    return res.status(400).json({ erro: "Nome e código interno são obrigatórios." });
  }

  const data = db.load();
  const existeCodigo = data.produtos.some(p => p.codigoInterno === body.codigoInterno);
  if (existeCodigo) return res.status(409).json({ erro: "Já existe um produto com este código interno." });

  data.contadores.produto += 1;
  const novo = {
    id: data.contadores.produto,
    tipo: "equipamento_final",
    codigoInterno: body.codigoInterno,
    codigoBarras: body.codigoBarras || null,
    qrCode: null,
    nome: body.nome,
    categoria: body.categoria || "Equipamento",
    fabricante: null,
    fornecedorId: null,
    fornecedor: null,
    unidadeMedida: body.unidadeMedida || "un",
    localizacao: body.localizacao || null,
    lote: null,
    numeroSerie: null,
    dataFabricacao: null,
    validade: null,
    peso: null,
    dimensoes: null,
    setor: body.setor || "producao",
    quantidade: Number(body.quantidade || 0),
    estoqueMinimo: 0,
    estoqueMaximo: null,
    valorUnitario: Number(body.valorUnitario || 0),
    foto: body.foto || null,
    componentes: [],
    ncm: body.ncm || "00000000",
    cfopPadrao: body.cfopPadrao || "5101",
    cstIcms: body.cstIcms || "000",
    aliquotaIcms: Number(body.aliquotaIcms || 0),
    cstPis: body.cstPis || "01",
    aliquotaPis: Number(body.aliquotaPis || 1.65),
    cstCofins: body.cstCofins || "01",
    aliquotaCofins: Number(body.aliquotaCofins || 7.6),
    criadoEm: new Date().toISOString()
  };
  data.produtos.push(novo);
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "CRIAR_EQUIPAMENTO_FINAL", entidade: "produto", entidadeId: novo.id });
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

// ---------- Ficha técnica (estrutura de matérias-primas do produto) ----------
router.get("/:id/ficha-tecnica", (req, res) => {
  const data = db.load();
  const produto = data.produtos.find(p => p.id === parseInt(req.params.id, 10));
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado." });

  const componentes = (produto.componentes || []).map(c => {
    const materiaPrima = data.produtos.find(p => p.id === c.produtoId);
    return {
      produtoId: c.produtoId,
      quantidadePorUnidade: c.quantidadePorUnidade,
      produtoNome: materiaPrima ? materiaPrima.nome : "(produto removido)",
      codigoInterno: materiaPrima ? materiaPrima.codigoInterno : null,
      unidadeMedida: materiaPrima ? materiaPrima.unidadeMedida : null,
      estoqueAtual: materiaPrima ? materiaPrima.quantidade : null
    };
  });

  res.json({ produtoId: produto.id, produtoNome: produto.nome, componentes });
});

router.put("/:id/ficha-tecnica", authorize("administrador", "supervisor", "almoxarife"), (req, res) => {
  const data = db.load();
  const produto = data.produtos.find(p => p.id === parseInt(req.params.id, 10));
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado." });

  if ((produto.tipo || "materia_prima") !== "equipamento_final") {
    return res.status(400).json({ erro: "Ficha técnica só pode ser configurada em equipamentos finais." });
  }

  const { componentes } = req.body;
  if (!Array.isArray(componentes)) {
    return res.status(400).json({ erro: "Envie a lista de componentes (matérias-primas)." });
  }

  for (const c of componentes) {
    if (!c.produtoId || !c.quantidadePorUnidade || c.quantidadePorUnidade <= 0) {
      return res.status(400).json({ erro: "Cada componente precisa de um produto e uma quantidade por unidade maior que zero." });
    }
    if (parseInt(c.produtoId, 10) === produto.id) {
      return res.status(400).json({ erro: "Um produto não pode ser componente dele mesmo." });
    }
    const materiaPrima = data.produtos.find(p => p.id === parseInt(c.produtoId, 10));
    if (!materiaPrima) return res.status(400).json({ erro: `Componente com id ${c.produtoId} não foi encontrado.` });
    if ((materiaPrima.tipo || "materia_prima") === "equipamento_final") {
      return res.status(400).json({ erro: `"${materiaPrima.nome}" é um equipamento final e não pode ser usado como matéria-prima.` });
    }
  }

  produto.componentes = componentes.map(c => ({
    produtoId: parseInt(c.produtoId, 10),
    quantidadePorUnidade: Number(c.quantidadePorUnidade)
  }));
  db.save(data);

  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "ATUALIZAR_FICHA_TECNICA", entidade: "produto", entidadeId: produto.id, detalhes: `${produto.componentes.length} componente(s)` });
  res.json({ produtoId: produto.id, componentes: produto.componentes });
});

module.exports = router;
module.exports.calcularStatus = calcularStatus;
