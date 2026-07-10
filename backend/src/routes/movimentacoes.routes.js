// src/routes/movimentacoes.routes.js
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { registrarLog } = require("../utils/audit");

const router = express.Router();
router.use(authenticate);

const TIPOS_VALIDOS = ["entrada", "saida", "transferencia", "ajuste", "devolucao", "emprestimo", "inventario"];

// ---------- Listar (com filtro por tipo/produto/usuário) ----------
router.get("/", (req, res) => {
  const { tipo, produtoId, usuarioId } = req.query;
  const data = db.load();
  let lista = [...data.movimentacoes];

  if (tipo) lista = lista.filter(m => m.tipo === tipo);
  if (produtoId) lista = lista.filter(m => m.produtoId === parseInt(produtoId, 10));
  if (usuarioId) lista = lista.filter(m => m.usuarioId === parseInt(usuarioId, 10));

  lista.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
  res.json(lista);
});

// ---------- Registrar movimentação ----------
router.post("/", (req, res) => {
  const { produtoId, tipo, quantidade, motivo, observacoes, documento, setorDestino, retiradoPor } = req.body;

  if (!produtoId || !tipo || !quantidade) {
    return res.status(400).json({ erro: "produtoId, tipo e quantidade são obrigatórios." });
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ erro: `Tipo inválido. Use um de: ${TIPOS_VALIDOS.join(", ")}.` });
  }

  const data = db.load();
  const produto = data.produtos.find(p => p.id === parseInt(produtoId, 10));
  if (!produto) return res.status(404).json({ erro: "Produto não encontrado." });

  const qtd = Number(quantidade);
  let novaQuantidade = produto.quantidade;

  if (tipo === "entrada" || tipo === "devolucao") {
    novaQuantidade += qtd;
  } else if (tipo === "saida" || tipo === "emprestimo") {
    if (qtd > produto.quantidade) {
      return res.status(400).json({ erro: `Quantidade insuficiente em estoque. Disponível: ${produto.quantidade}.` });
    }
    novaQuantidade -= qtd;
  } else if (tipo === "ajuste" || tipo === "inventario") {
    novaQuantidade = qtd; // ajuste define o valor absoluto
  } else if (tipo === "transferencia") {
    if (qtd > produto.quantidade) {
      return res.status(400).json({ erro: `Quantidade insuficiente para transferência. Disponível: ${produto.quantidade}.` });
    }
    novaQuantidade -= qtd;
  }

  produto.quantidade = novaQuantidade;

  data.contadores.movimentacao += 1;
  const movimentacao = {
    id: data.contadores.movimentacao,
    produtoId: produto.id,
    produtoNome: produto.nome,
    tipo,
    quantidade: qtd,
    setorDestino: setorDestino || null,
    retiradoPor: retiradoPor || null,
    motivo: motivo || null,
    observacoes: observacoes || null,
    documento: documento || null,
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    dataHora: new Date().toISOString()
  };
  data.movimentacoes.push(movimentacao);
  db.save(data);

  registrarLog({
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    acao: "MOVIMENTACAO_" + tipo.toUpperCase(),
    entidade: "movimentacao",
    entidadeId: movimentacao.id,
    detalhes: `${qtd} un. de ${produto.nome}`
  });

  res.status(201).json(movimentacao);
});

module.exports = router;
