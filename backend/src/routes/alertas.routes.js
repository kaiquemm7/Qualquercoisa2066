// src/routes/alertas.routes.js
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { calcularStatus } = require("./produtos.routes");

const router = express.Router();
router.use(authenticate);

router.get("/", (req, res) => {
  const data = db.load();
  const produtos = data.produtos.map(p => ({ ...p, status: calcularStatus(p) }));

  const alertas = [];

  produtos.forEach(p => {
    if (p.status === "falta") {
      alertas.push({ severidade: "critico", titulo: `${p.nome} zerado`, descricao: `Estoque em 0 unidades. Mínimo configurado: ${p.estoqueMinimo}.`, produtoId: p.id, setor: p.setor });
    }
    if (p.status === "vencido") {
      alertas.push({ severidade: "critico", titulo: `${p.nome} vencido`, descricao: `Validade em ${p.validade}. Produto permanece ativo no estoque.`, produtoId: p.id, setor: p.setor });
    }
    if (p.status === "critico") {
      alertas.push({ severidade: "atencao", titulo: `${p.nome} abaixo do mínimo`, descricao: `${p.quantidade} unidades em estoque, mínimo é ${p.estoqueMinimo}.`, produtoId: p.id, setor: p.setor });
    }
    if (p.status === "vence_em_breve") {
      alertas.push({ severidade: "atencao", titulo: `${p.nome} vence em breve`, descricao: `Validade em ${p.validade}.`, produtoId: p.id, setor: p.setor });
    }
    if (p.status === "excesso") {
      alertas.push({ severidade: "info", titulo: `${p.nome} acima do máximo`, descricao: `${p.quantidade} unidades em estoque, máximo configurado é ${p.estoqueMaximo}.`, produtoId: p.id, setor: p.setor });
    }
  });

  res.json(alertas);
});

module.exports = router;
