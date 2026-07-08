// src/routes/auditoria.routes.js
const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");

const router = express.Router();
router.use(authenticate);

router.get("/logs", authorize("administrador", "auditor"), (req, res) => {
  const data = db.load();
  const logs = [...data.logs].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
  res.json(logs);
});

module.exports = router;
