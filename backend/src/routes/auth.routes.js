// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const rateLimit = require("express-rate-limit");
const db = require("../config/db");
const { registrarLog } = require("../utils/audit");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const MAX_TENTATIVAS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5", 10);
const TEMPO_BLOQUEIO_MIN = parseInt(process.env.LOCK_TIME_MINUTES || "15", 10);

// Limita tentativas de login por IP (proteção adicional contra força bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { erro: "Muitas tentativas deste IP. Aguarde alguns minutos." }
});

// ---------- LOGIN (passo 1: usuário + senha) ----------
router.post("/login", loginLimiter, (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) {
    return res.status(400).json({ erro: "Informe usuário e senha." });
  }

  const data = db.load();
  const user = data.usuarios.find(u => u.usuario === usuario);

  if (!user) {
    registrarLog({ usuarioNome: usuario, acao: "LOGIN_FALHOU", entidade: "usuario", detalhes: "Usuário não encontrado", ip: req.ip });
    return res.status(401).json({ erro: "Usuário ou senha inválidos." });
  }

  // Verifica bloqueio por tentativas
  if (user.bloqueadoAte && new Date(user.bloqueadoAte) > new Date()) {
    const minutosRestantes = Math.ceil((new Date(user.bloqueadoAte) - new Date()) / 60000);
    return res.status(423).json({ erro: `Conta bloqueada por excesso de tentativas. Tente novamente em ${minutosRestantes} min.` });
  }

  const senhaValida = bcrypt.compareSync(senha, user.senhaHash);

  if (!senhaValida) {
    user.tentativasFalhas = (user.tentativasFalhas || 0) + 1;
    if (user.tentativasFalhas >= MAX_TENTATIVAS) {
      user.bloqueadoAte = new Date(Date.now() + TEMPO_BLOQUEIO_MIN * 60000).toISOString();
      user.tentativasFalhas = 0;
    }
    db.save(data);
    registrarLog({ usuarioId: user.id, usuarioNome: user.usuario, acao: "LOGIN_FALHOU", entidade: "usuario", detalhes: "Senha incorreta", ip: req.ip });
    return res.status(401).json({ erro: "Usuário ou senha inválidos." });
  }

  // Login/senha corretos: zera tentativas
  user.tentativasFalhas = 0;
  user.bloqueadoAte = null;
  db.save(data);

  // Se o usuário tem 2FA ativado, exige segunda etapa antes de emitir o token final
  if (user.twoFactorAtivo) {
    const tempToken = jwt.sign({ id: user.id, etapa: "2fa_pendente" }, process.env.JWT_SECRET, { expiresIn: "5m" });
    return res.json({ requer2FA: true, tempToken });
  }

  const token = emitirToken(user);
  registrarLog({ usuarioId: user.id, usuarioNome: user.usuario, acao: "LOGIN", entidade: "usuario", ip: req.ip });
  return res.json({ token, usuario: sanitizarUsuario(user) });
});

// ---------- LOGIN (passo 2: código do autenticador) ----------
router.post("/login/2fa", loginLimiter, (req, res) => {
  const { tempToken, codigo } = req.body;
  if (!tempToken || !codigo) return res.status(400).json({ erro: "Token temporário e código são obrigatórios." });

  let payload;
  try {
    payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (payload.etapa !== "2fa_pendente") throw new Error("etapa inválida");
  } catch {
    return res.status(401).json({ erro: "Sessão de 2FA expirada. Faça login novamente." });
  }

  const data = db.load();
  const user = data.usuarios.find(u => u.id === payload.id);
  if (!user) return res.status(401).json({ erro: "Usuário não encontrado." });

  const valido = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token: codigo,
    window: 1
  });

  if (!valido) {
    registrarLog({ usuarioId: user.id, usuarioNome: user.usuario, acao: "LOGIN_2FA_FALHOU", entidade: "usuario", ip: req.ip });
    return res.status(401).json({ erro: "Código de verificação inválido." });
  }

  const token = emitirToken(user);
  registrarLog({ usuarioId: user.id, usuarioNome: user.usuario, acao: "LOGIN", entidade: "usuario", detalhes: "com 2FA", ip: req.ip });
  return res.json({ token, usuario: sanitizarUsuario(user) });
});

// ---------- Ativar 2FA (usuário autenticado) ----------
router.post("/2fa/gerar", authenticate, async (req, res) => {
  const data = db.load();
  const user = data.usuarios.find(u => u.id === req.usuario.id);
  if (!user) return res.status(404).json({ erro: "Usuário não encontrado." });

  const secret = speakeasy.generateSecret({ name: `NORTA WMS (${user.usuario})` });
  user.twoFactorSecretPendente = secret.base32;
  db.save(data);

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ qrCode: qrDataUrl, chaveManual: secret.base32 });
});

router.post("/2fa/confirmar", authenticate, (req, res) => {
  const { codigo } = req.body;
  const data = db.load();
  const user = data.usuarios.find(u => u.id === req.usuario.id);
  if (!user || !user.twoFactorSecretPendente) {
    return res.status(400).json({ erro: "Nenhuma configuração de 2FA pendente." });
  }

  const valido = speakeasy.totp.verify({
    secret: user.twoFactorSecretPendente,
    encoding: "base32",
    token: codigo,
    window: 1
  });
  if (!valido) return res.status(400).json({ erro: "Código inválido. Tente novamente." });

  user.twoFactorSecret = user.twoFactorSecretPendente;
  user.twoFactorSecretPendente = null;
  user.twoFactorAtivo = true;
  db.save(data);
  registrarLog({ usuarioId: user.id, usuarioNome: user.usuario, acao: "2FA_ATIVADO", entidade: "usuario" });
  res.json({ mensagem: "Autenticação em dois fatores ativada." });
});

// ---------- Dados do usuário logado ----------
router.get("/me", authenticate, (req, res) => {
  const data = db.load();
  const user = data.usuarios.find(u => u.id === req.usuario.id);
  if (!user) return res.status(404).json({ erro: "Usuário não encontrado." });
  res.json(sanitizarUsuario(user));
});

function emitirToken(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, papel: user.papel, setor: user.setor },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

function sanitizarUsuario(user) {
  const { senhaHash, twoFactorSecret, twoFactorSecretPendente, ...resto } = user;
  return resto;
}

module.exports = router;
