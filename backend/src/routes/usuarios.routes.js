// src/routes/usuarios.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { registrarLog } = require("../utils/audit");

const router = express.Router();
router.use(authenticate);

function sanitizar(u) {
  const { senhaHash, twoFactorSecret, twoFactorSecretPendente, ...resto } = u;
  return resto;
}

// ---------- Listar funcionários ----------
router.get("/", authorize("administrador", "supervisor"), (req, res) => {
  const data = db.load();
  res.json(data.usuarios.map(sanitizar));
});

// ---------- Criar funcionário ----------
router.post("/", authorize("administrador"), (req, res) => {
  const { nome, usuario, senha, papel, setor, cargo, foto } = req.body;
  if (!nome || !usuario || !senha || !papel) {
    return res.status(400).json({ erro: "nome, usuario, senha e papel são obrigatórios." });
  }
  const papeisValidos = ["administrador", "supervisor", "almoxarife", "compras", "producao", "auditor"];
  if (!papeisValidos.includes(papel)) {
    return res.status(400).json({ erro: `Papel inválido. Use um de: ${papeisValidos.join(", ")}.` });
  }

  const data = db.load();
  if (data.usuarios.some(u => u.usuario === usuario)) {
    return res.status(409).json({ erro: "Nome de usuário já existe." });
  }

  data.contadores.usuario += 1;
  const novo = {
    id: data.contadores.usuario,
    nome,
    usuario,
    senhaHash: bcrypt.hashSync(senha, parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10)),
    papel,
    setor: setor || null,
    cargo: cargo || null,
    foto: foto || null,
    twoFactorAtivo: false,
    tentativasFalhas: 0,
    bloqueadoAte: null,
    criadoEm: new Date().toISOString()
  };
  data.usuarios.push(novo);
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "CRIAR_USUARIO", entidade: "usuario", entidadeId: novo.id });
  res.status(201).json(sanitizar(novo));
});

// ---------- Histórico de movimentações de um funcionário ----------
router.get("/:id/movimentacoes", authorize("administrador", "supervisor", "auditor"), (req, res) => {
  const data = db.load();
  const lista = data.movimentacoes.filter(m => m.usuarioId === parseInt(req.params.id, 10));
  res.json(lista);
});

module.exports = router;
