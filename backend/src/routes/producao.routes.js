// src/routes/producao.routes.js
//
// Fluxo:
// 1) POST /calcular  -> dado um produto final e uma quantidade a produzir,
//    devolve a lista de matérias-primas necessárias (puxadas da ficha
//    técnica do produto) já multiplicadas pela quantidade, mostrando se o
//    estoque atual é suficiente para cada uma. Nada é salvo aqui.
// 2) POST /           -> confirma a produção: dá baixa em cada matéria-prima
//    (proporcional à ficha técnica) e dá entrada na quantidade produzida do
//    produto final, tudo registrado como uma "ordem de produção".

const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { registrarLog } = require("../utils/audit");

const router = express.Router();
router.use(authenticate);

function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function calcularConsumo(data, produtoFinal, quantidade) {
  const componentes = produtoFinal.componentes || [];
  return componentes.map(c => {
    const materiaPrima = data.produtos.find(p => p.id === c.produtoId);
    const quantidadeNecessaria = c.quantidadePorUnidade * quantidade;
    return {
      produtoId: c.produtoId,
      produtoNome: materiaPrima ? materiaPrima.nome : "(produto removido)",
      codigoInterno: materiaPrima ? materiaPrima.codigoInterno : null,
      unidadeMedida: materiaPrima ? materiaPrima.unidadeMedida : null,
      quantidadePorUnidade: c.quantidadePorUnidade,
      quantidadeNecessaria,
      estoqueAtual: materiaPrima ? materiaPrima.quantidade : 0,
      suficiente: materiaPrima ? materiaPrima.quantidade >= quantidadeNecessaria : false
    };
  });
}

// ---------- Calcular prévia (sem salvar) ----------
router.post("/calcular", (req, res) => {
  const { produtoFinalId, quantidade } = req.body;
  if (!produtoFinalId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: "Informe o produto final e uma quantidade maior que zero." });
  }

  const data = db.load();
  const produtoFinal = data.produtos.find(p => p.id === parseInt(produtoFinalId, 10));
  if (!produtoFinal) return res.status(404).json({ erro: "Produto final não encontrado." });

  if (!produtoFinal.componentes || produtoFinal.componentes.length === 0) {
    return res.status(400).json({ erro: `"${produtoFinal.nome}" ainda não tem uma ficha técnica cadastrada. Configure os componentes dele antes de lançar produção.` });
  }

  const consumo = calcularConsumo(data, produtoFinal, Number(quantidade));
  res.json({
    produtoFinalId: produtoFinal.id,
    produtoFinalNome: produtoFinal.nome,
    quantidade: Number(quantidade),
    componentes: consumo,
    podeProduzir: consumo.every(c => c.suficiente)
  });
});

// ---------- Listar ordens de produção ----------
router.get("/", (req, res) => {
  const { busca } = req.query;
  const data = db.load();
  let lista = [...data.producoes];

  if (busca) {
    const q = normalizar(busca);
    lista = lista.filter(o => normalizar(o.produtoFinalNome).includes(q));
  }

  lista.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  res.json(lista);
});

router.get("/:id", (req, res) => {
  const data = db.load();
  const ordem = data.producoes.find(o => o.id === parseInt(req.params.id, 10));
  if (!ordem) return res.status(404).json({ erro: "Ordem de produção não encontrada." });
  res.json(ordem);
});

// ---------- Confirmar/lançar produção ----------
router.post("/", authorize("administrador", "supervisor", "almoxarife", "producao"), (req, res) => {
  const { produtoFinalId, quantidade, observacoes } = req.body;
  if (!produtoFinalId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: "Informe o produto final e uma quantidade maior que zero." });
  }

  const data = db.load();
  const produtoFinal = data.produtos.find(p => p.id === parseInt(produtoFinalId, 10));
  if (!produtoFinal) return res.status(404).json({ erro: "Produto final não encontrado." });

  if (!produtoFinal.componentes || produtoFinal.componentes.length === 0) {
    return res.status(400).json({ erro: `"${produtoFinal.nome}" não tem ficha técnica cadastrada.` });
  }

  const consumo = calcularConsumo(data, produtoFinal, Number(quantidade));
  const faltantes = consumo.filter(c => !c.suficiente);
  if (faltantes.length > 0) {
    return res.status(400).json({
      erro: "Estoque insuficiente para produzir essa quantidade.",
      itensFaltantes: faltantes.map(f => `${f.produtoNome}: precisa de ${f.quantidadeNecessaria}, disponível ${f.estoqueAtual}`)
    });
  }

  data.contadores.producao += 1;
  const numeroOrdem = data.contadores.producao;

  const componentesConsumidos = [];
  for (const item of consumo) {
    const materiaPrima = data.produtos.find(p => p.id === item.produtoId);
    materiaPrima.quantidade -= item.quantidadeNecessaria;

    data.contadores.movimentacao += 1;
    data.movimentacoes.push({
      id: data.contadores.movimentacao,
      produtoId: materiaPrima.id,
      produtoNome: materiaPrima.nome,
      tipo: "saida",
      quantidade: item.quantidadeNecessaria,
      setorDestino: "producao",
      retiradoPor: null,
      motivo: `Consumo em produção — Ordem #${numeroOrdem} (${produtoFinal.nome})`,
      observacoes: null,
      documento: `PROD-${numeroOrdem}`,
      usuarioId: req.usuario.id,
      usuarioNome: req.usuario.nome,
      dataHora: new Date().toISOString()
    });

    componentesConsumidos.push({
      produtoId: materiaPrima.id,
      produtoNome: materiaPrima.nome,
      quantidadeConsumida: item.quantidadeNecessaria
    });
  }

  produtoFinal.quantidade += Number(quantidade);
  data.contadores.movimentacao += 1;
  data.movimentacoes.push({
    id: data.contadores.movimentacao,
    produtoId: produtoFinal.id,
    produtoNome: produtoFinal.nome,
    tipo: "entrada",
    quantidade: Number(quantidade),
    setorDestino: null,
    retiradoPor: null,
    motivo: `Produção concluída — Ordem #${numeroOrdem}`,
    observacoes: observacoes || null,
    documento: `PROD-${numeroOrdem}`,
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    dataHora: new Date().toISOString()
  });

  const ordem = {
    id: numeroOrdem,
    produtoFinalId: produtoFinal.id,
    produtoFinalNome: produtoFinal.nome,
    quantidadeProduzida: Number(quantidade),
    componentesConsumidos,
    observacoes: observacoes || null,
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    criadoEm: new Date().toISOString()
  };
  data.producoes.push(ordem);
  db.save(data);

  registrarLog({
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    acao: "LANCAR_PRODUCAO",
    entidade: "producao",
    entidadeId: ordem.id,
    detalhes: `${quantidade}x ${produtoFinal.nome} — ${componentesConsumidos.length} matéria(s)-prima(s) consumida(s)`
  });

  res.status(201).json(ordem);
});

module.exports = router;
