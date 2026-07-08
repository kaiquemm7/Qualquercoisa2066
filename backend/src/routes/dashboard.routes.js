// src/routes/dashboard.routes.js
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { calcularStatus } = require("./produtos.routes");

const router = express.Router();
router.use(authenticate);

router.get("/", (req, res) => {
  const data = db.load();
  const produtos = data.produtos.map(p => ({ ...p, status: calcularStatus(p) }));

  const valorTotalEstoque = produtos.reduce((soma, p) => soma + p.quantidade * (p.valorUnitario || 0), 0);
  const emFalta = produtos.filter(p => p.status === "falta").length;
  const criticos = produtos.filter(p => p.status === "critico").length;
  const vencidos = produtos.filter(p => p.status === "vencido").length;
  const venceEmBreve = produtos.filter(p => p.status === "vence_em_breve").length;
  const excesso = produtos.filter(p => p.status === "excesso").length;
  const saudaveis = produtos.filter(p => p.status === "saudavel").length;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const movimentacoesMes = data.movimentacoes.filter(m => new Date(m.dataHora) >= inicioMes);
  const entradasMes = movimentacoesMes.filter(m => m.tipo === "entrada").length;
  const saidasMes = movimentacoesMes.filter(m => m.tipo === "saida").length;

  // ranking de produtos mais movimentados (saídas) nos últimos 90 dias
  const noventaDias = new Date(Date.now() - 90 * 86400000);
  const contagem = {};
  data.movimentacoes
    .filter(m => m.tipo === "saida" && new Date(m.dataHora) >= noventaDias)
    .forEach(m => { contagem[m.produtoNome] = (contagem[m.produtoNome] || 0) + m.quantidade; });
  const ranking = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, total]) => ({ nome, total }));

  res.json({
    valorTotalEstoque: Math.round(valorTotalEstoque * 100) / 100,
    totalProdutos: produtos.length,
    emFalta,
    criticos,
    vencidos,
    venceEmBreve,
    excesso,
    saudaveis,
    entradasMes,
    saidasMes,
    ranking,
    movimentacoesRecentes: [...data.movimentacoes].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora)).slice(0, 8)
  });
});

module.exports = router;
