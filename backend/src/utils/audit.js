// src/utils/audit.js
const db = require("../config/db");

function registrarLog({ usuarioId, usuarioNome, acao, entidade, entidadeId, detalhes, ip }) {
  const data = db.load();
  data.contadores.log += 1;
  data.logs.push({
    id: data.contadores.log,
    usuarioId,
    usuarioNome,
    acao,           // ex: "LOGIN", "CRIAR_PRODUTO", "MOVIMENTACAO", "LOGIN_FALHOU"
    entidade,        // ex: "produto", "movimentacao", "usuario"
    entidadeId: entidadeId || null,
    detalhes: detalhes || null,
    ip: ip || null,
    dataHora: new Date().toISOString()
  });
  db.save(data);
}

module.exports = { registrarLog };
