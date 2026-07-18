// src/routes/ncm.routes.js
//
// Consulta a tabela de NCM (Nomenclatura Comum do Mercosul) usada pela
// Receita Federal, via BrasilAPI — que espelha a tabela oficial mantida
// pelo governo. Para a busca funcionar instantaneamente enquanto a pessoa
// digita (sem esperar ida e volta na rede a cada letra), a tabela inteira
// é baixada uma vez e mantida em cache na memória do servidor por algumas
// horas; a filtragem por código ou descrição acontece localmente.

const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const BASE_URL = "https://brasilapi.com.br/api/ncm/v1";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

let cacheTabela = null;
let cacheEm = 0;

async function obterTabela() {
  const agora = Date.now();
  if (cacheTabela && (agora - cacheEm) < CACHE_TTL_MS) return cacheTabela;

  const resp = await fetch(BASE_URL);
  if (!resp.ok) throw new Error(`status ${resp.status}`);
  const dados = await resp.json();
  cacheTabela = Array.isArray(dados) ? dados : [];
  cacheEm = agora;
  return cacheTabela;
}

function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ---------- Buscar por código ou descrição (busca instantânea, tabela em cache) ----------
router.get("/", async (req, res) => {
  const { busca } = req.query;
  if (!busca || busca.trim().length < 2) {
    return res.status(400).json({ erro: "Digite ao menos 2 caracteres para buscar." });
  }

  try {
    const tabela = await obterTabela();
    const termo = busca.trim();
    const termoDigitos = termo.replace(/\D/g, "");
    const termoNormalizado = normalizar(termo);

    const resultado = tabela.filter(n => {
      const bateCodigo = termoDigitos.length >= 2 && (n.codigo || "").replace(/\D/g, "").startsWith(termoDigitos);
      const bateDescricao = normalizar(n.descricao).includes(termoNormalizado);
      return bateCodigo || bateDescricao;
    }).slice(0, 30);

    res.json(resultado);
  } catch (err) {
    res.status(502).json({ erro: "Não foi possível consultar a tabela oficial de NCM agora. Tente novamente em instantes." });
  }
});

// ---------- Buscar por código exato ----------
router.get("/:codigo", async (req, res) => {
  const codigo = req.params.codigo.replace(/\D/g, "");
  if (!codigo) return res.status(400).json({ erro: "Informe um código NCM válido." });

  try {
    const tabela = await obterTabela();
    const encontrado = tabela.find(n => (n.codigo || "").replace(/\D/g, "") === codigo);
    if (!encontrado) {
      return res.status(404).json({ erro: `NCM ${codigo} não foi encontrado na tabela oficial da Receita Federal.` });
    }
    res.json(encontrado);
  } catch (err) {
    res.status(502).json({ erro: "Não foi possível consultar a tabela oficial de NCM agora. Tente novamente em instantes." });
  }
});

module.exports = router;
