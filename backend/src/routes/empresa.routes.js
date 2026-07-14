// src/routes/empresa.routes.js
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { registrarLog } = require("../utils/audit");

const router = express.Router();
router.use(authenticate);

router.get("/", (req, res) => {
  const data = db.load();
  res.json(data.empresa);
});

router.put("/", authorize("administrador"), (req, res) => {
  const data = db.load();
  data.empresa = { ...data.empresa, ...req.body };
  db.save(data);
  registrarLog({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: "ATUALIZAR_EMPRESA", entidade: "empresa" });
  res.json(data.empresa);
});

module.exports = router;
