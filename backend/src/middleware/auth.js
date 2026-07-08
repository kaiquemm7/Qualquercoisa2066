// src/middleware/auth.js
const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token de acesso ausente." });
  }
  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, nome, papel, setor }
    next();
  } catch (err) {
    return res.status(401).json({ erro: "Sessão expirada ou token inválido. Faça login novamente." });
  }
}

module.exports = { authenticate };
