// src/middleware/roles.js
// Controle de acesso por níveis: Administrador, Supervisor, Almoxarife,
// Compras, Produção, Auditor.

function authorize(...papeisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: "Não autenticado." });
    }
    if (req.usuario.papel === "administrador") return next(); // admin sempre passa
    if (!papeisPermitidos.includes(req.usuario.papel)) {
      return res.status(403).json({
        erro: `Seu nível de acesso (${req.usuario.papel}) não permite esta ação.`
      });
    }
    next();
  };
}

module.exports = { authorize };
