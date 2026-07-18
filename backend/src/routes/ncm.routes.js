// src/routes/ncm.routes.js
//
// Consulta a tabela de NCM (Nomenclatura Comum do Mercosul) usada pela
// Receita Federal, via BrasilAPI — que espelha a tabela oficial mantida
// pelo governo. Serve para conferir se o código NCM cadastrado num produto
// existe de verdade e bate com a descrição oficial, antes de usar esse
// código na geração do SPED.

const express = require("express");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const BASE_URL = "https://brasilapi.com.br/api/ncm/v1";

// ---------- Buscar por código exato ----------
router.get("/:codigo", async (req, res) => {
  const codigo = req.params.codigo.replace(/\D/g, "");
  if (!codigo) return res.status(400).json({ erro: "Informe um código NCM válido." });

  try {
    const resp = await fetch(`${BASE_URL}/${codigo}`);
    if (resp.status === 404) {
      return res.status(404).json({ erro: `NCM ${codigo} não foi encontrado na tabela oficial da Receita Federal.` });
    }
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const dados = await resp.json();
    res.json(dados);
  } catch (err) {
    res.status(502).json({ erro: "Não foi possível consultar a tabela oficial de NCM agora. Tente novamente em instantes." });
  }
});

// ---------- Buscar por termo (descrição) ----------
router.get("/", async (req, res) => {
  const { busca } = req.query;
  if (!busca || busca.trim().length < 3) {
    return res.status(400).json({ erro: "Digite ao menos 3 letras para buscar por descrição." });
  }

  try {
    const resp = await fetch(`${BASE_URL}?search=${encodeURIComponent(busca.trim())}`);
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const dados = await resp.json();
    res.json(Array.isArray(dados) ? dados.slice(0, 40) : []);
  } catch (err) {
    res.status(502).json({ erro: "Não foi possível consultar a tabela oficial de NCM agora. Tente novamente em instantes." });
  }
});

module.exports = router;
