// js/app.js

const icons = {
  box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18l6-13 4 8 3-5 5 10z"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8h.01M11 12h1v5h1"/><circle cx="12" cy="12" r="9"/></svg>'
};
const statusLabel = { saudavel:"Saudável", critico:"Crítico", falta:"Em falta", vencido:"Vencido", vence_em_breve:"Vence em breve", excesso:"Excesso" };
const tipoLabel = { entrada:"Entrada", saida:"Saída", transferencia:"Transferência", ajuste:"Ajuste", devolucao:"Devolução", emprestimo:"Empréstimo", inventario:"Inventário" };

let usuarioAtual = null;
let produtosCache = [];

// ---------- Boot ----------
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginForm").addEventListener("submit", tratarLogin);
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => trocarView(item.dataset.view));
  });
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("btnNovaMovimentacao").addEventListener("click", abrirModalMovimentacao);
  document.getElementById("btnNovoProduto").addEventListener("click", abrirModalProduto);
  document.getElementById("stockSearch").addEventListener("input", filtrarEstoque);
  document.getElementById("btnRegistrarFuncionario").addEventListener("click", abrirModalFuncionario);

  if (getToken()) {
    carregarSessao();
  } else {
    mostrarLogin();
  }
});

function mostrarLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

async function carregarSessao() {
  try {
    usuarioAtual = await api("GET", "/auth/me");
    mostrarApp();
  } catch {
    mostrarLogin();
  }
}

async function tratarLogin(e) {
  e.preventDefault();
  const usuario = document.getElementById("loginUsuario").value.trim();
  const senha = document.getElementById("loginSenha").value;
  const erroBox = document.getElementById("loginError");
  erroBox.classList.add("hidden");

  try {
    const resp = await api("POST", "/auth/login", { usuario, senha });
    if (resp.requer2FA) {
      erroBox.textContent = "2FA habilitado para este usuário — recurso completo disponível na tela de segurança após o login inicial.";
      erroBox.classList.remove("hidden");
      return;
    }
    setToken(resp.token);
    usuarioAtual = resp.usuario;
    mostrarApp();
  } catch (err) {
    erroBox.textContent = err.message;
    erroBox.classList.remove("hidden");
  }
}

function logout() {
  clearToken();
  usuarioAtual = null;
  document.getElementById("loginForm").reset();
  mostrarLogin();
}

function mostrarApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  document.getElementById("userName").textContent = usuarioAtual.nome;
  document.getElementById("userRole").textContent = usuarioAtual.papel;
  document.getElementById("userAvatar").textContent = iniciais(usuarioAtual.nome);

  // Esconde itens de menu restritos por papel
  const podeGerenciarGente = ["administrador", "supervisor"].includes(usuarioAtual.papel);
  document.querySelectorAll('[data-view="funcionarios"]').forEach(el => el.classList.toggle("hidden", !podeGerenciarGente));
  document.querySelectorAll('[data-view="auditoria"]').forEach(el => el.classList.toggle("hidden", !["administrador","auditor"].includes(usuarioAtual.papel)));

  trocarView("dashboard");
}

function iniciais(nome) {
  return nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

// ---------- Navegação ----------
async function trocarView(view) {
  document.querySelectorAll(".nav-item").forEach(i => i.classList.toggle("active", i.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));

  try {
    if (view === "dashboard") await carregarDashboard();
    if (view === "estoque") await carregarEstoque();
    if (view === "movimentacoes") await carregarMovimentacoes();
    if (view === "alertas") await carregarAlertas();
    if (view === "funcionarios") await carregarFuncionarios();
    if (view === "auditoria") await carregarAuditoria();
  } catch (err) {
    mostrarToast(err.message, "error");
  }
}

// ---------- Dashboard ----------
async function carregarDashboard() {
  const d = await api("GET", "/dashboard");

  document.getElementById("kpiValor").textContent = "R$ " + d.valorTotalEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  document.getElementById("kpiFalta").textContent = d.emFalta;
  document.getElementById("kpiCritico").textContent = d.criticos;
  document.getElementById("kpiVencido").textContent = d.vencidos;
  document.getElementById("kpiEntradas").textContent = d.entradasMes;
  document.getElementById("kpiSaidas").textContent = d.saidasMes;

  const total = d.saudaveis + d.criticos + d.emFalta + d.vencidos + d.excesso || 1;
  document.getElementById("statusRail").innerHTML = [
    ["var(--success)", d.saudaveis], ["var(--warning)", d.criticos],
    ["var(--danger)", d.emFalta + d.vencidos], ["var(--info)", d.excesso]
  ].map(([c, v]) => `<div style="background:${c}; flex:${v || 0.0001}"></div>`).join("");
  document.getElementById("railPct").textContent = Math.round((d.saudaveis / total) * 100) + "% saudável";
  document.getElementById("railTotal").textContent = `Saúde do estoque · ${d.totalProdutos} itens ativos`;

  document.getElementById("rankList").innerHTML = d.ranking.length
    ? d.ranking.map((r, i) => {
        const max = d.ranking[0].total || 1;
        return `<div class="rank-row">
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); width:16px;">${String(i + 1).padStart(2, "0")}</span>
          <span class="rank-name">${r.nome}</span>
          <div class="rank-bar-bg"><div class="rank-bar-fg" style="width:${(r.total / max) * 100}%"></div></div>
          <span class="rank-val">${r.total} un.</span>
        </div>`;
      }).join("")
    : '<p style="color:var(--text-muted); font-size:12.5px;">Sem saídas registradas nos últimos 90 dias.</p>';

  document.getElementById("recentMoves").innerHTML = d.movimentacoesRecentes.length
    ? d.movimentacoesRecentes.map(m => `<tr>
        <td style="font-family:var(--font-mono); color:var(--text-secondary)">${formatarData(m.dataHora)}</td>
        <td>${m.produtoNome}</td><td>${badgeTipo(m.tipo)}</td>
        <td class="qty-cell">${sinalQtd(m.tipo)}${m.quantidade}</td><td>${m.usuarioNome}</td>
      </tr>`).join("")
    : '<tr class="empty-row"><td colspan="5">Nenhuma movimentação registrada ainda.</td></tr>';
}

// ---------- Estoque ----------
async function carregarEstoque() {
  produtosCache = await api("GET", "/produtos");
  renderEstoque(produtosCache);
}

function renderEstoque(lista) {
  document.getElementById("stockTable").innerHTML = lista.length ? lista.map(p => `
    <tr>
      <td><div class="prod-cell">
        <div class="prod-thumb">${icons.box}</div>
        <div><div class="prod-name">${p.nome}</div><div class="prod-code">${p.codigoInterno} · ${p.categoria}</div></div>
      </div></td>
      <td>${p.localizacao ? `<span class="tag-loc">${p.localizacao}</span>` : "—"}</td>
      <td style="font-family:var(--font-mono); color:var(--text-secondary)">${p.lote || "—"}</td>
      <td class="qty-cell">${p.quantidade} ${p.unidadeMedida}</td>
      <td class="qty-cell" style="color:var(--text-muted)">${p.estoqueMinimo}</td>
      <td style="color:var(--text-secondary)">${p.validade || "—"}</td>
      <td><span class="badge ${p.status}"><i></i>${statusLabel[p.status] || p.status}</span></td>
    </tr>`).join("") : '<tr class="empty-row"><td colspan="7">Nenhum produto encontrado.</td></tr>';
}

function filtrarEstoque(e) {
  const q = e.target.value.toLowerCase();
  renderEstoque(produtosCache.filter(p =>
    p.nome.toLowerCase().includes(q) || p.codigoInterno.toLowerCase().includes(q) ||
    (p.lote || "").toLowerCase().includes(q) || (p.fornecedor || "").toLowerCase().includes(q)
  ));
}

// ---------- Movimentações ----------
async function carregarMovimentacoes() {
  const lista = await api("GET", "/movimentacoes");
  document.getElementById("movesTable").innerHTML = lista.length ? lista.map(m => `
    <tr>
      <td style="font-family:var(--font-mono); color:var(--text-secondary)">${formatarData(m.dataHora)}</td>
      <td>${m.produtoNome}</td><td>${badgeTipo(m.tipo)}</td>
      <td class="qty-cell">${sinalQtd(m.tipo)}${m.quantidade}</td><td>${m.usuarioNome}</td>
      <td>${m.motivo || "—"}</td>
      <td style="font-family:var(--font-mono); color:var(--text-muted)">${m.documento || "—"}</td>
    </tr>`).join("") : '<tr class="empty-row"><td colspan="7">Nenhuma movimentação registrada.</td></tr>';
}

// ---------- Alertas ----------
async function carregarAlertas() {
  const lista = await api("GET", "/alertas");
  const iconeMap = { critico: "alert", atencao: "warn", info: "info" };
  document.getElementById("alertsList").innerHTML = lista.length ? lista.map(a => `
    <div class="alert-card ${a.severidade}">
      <div class="alert-icon" style="background:var(--${a.severidade === 'critico' ? 'danger' : a.severidade === 'atencao' ? 'warning' : 'info'}-dim); color:var(--${a.severidade === 'critico' ? 'danger' : a.severidade === 'atencao' ? 'warning' : 'info'}-text)">${icons[iconeMap[a.severidade]]}</div>
      <div style="flex:1">
        <div class="alert-title">${a.titulo}</div>
        <div class="alert-desc">${a.descricao}</div>
        <div class="alert-meta"><span>${a.setor || "—"}</span></div>
      </div>
    </div>`).join("") : '<p style="color:var(--text-muted); font-size:13px;">Nenhum alerta ativo no momento.</p>';
}

// ---------- Funcionários ----------
async function carregarFuncionarios() {
  const lista = await api("GET", "/usuarios");
  document.getElementById("funcTable").innerHTML = lista.map(u => `
    <tr>
      <td><div class="prod-cell"><div class="avatar" style="width:28px;height:28px;font-size:11px;">${iniciais(u.nome)}</div><div class="prod-name">${u.nome}</div></div></td>
      <td>${u.usuario}</td>
      <td><span class="badge saudavel"><i></i>${u.papel}</span></td>
      <td>${u.setor || "—"}</td>
      <td>${u.twoFactorAtivo ? "Ativo" : "Inativo"}</td>
    </tr>`).join("");
}

// ---------- Auditoria ----------
async function carregarAuditoria() {
  const lista = await api("GET", "/auditoria/logs");
  document.getElementById("auditTable").innerHTML = lista.length ? lista.slice(0, 100).map(l => `
    <tr>
      <td style="font-family:var(--font-mono); color:var(--text-secondary)">${formatarData(l.dataHora)}</td>
      <td>${l.usuarioNome || "—"}</td>
      <td style="font-family:var(--font-mono);">${l.acao}</td>
      <td>${l.detalhes || "—"}</td>
    </tr>`).join("") : '<tr class="empty-row"><td colspan="4">Nenhum registro de auditoria ainda.</td></tr>';
}

// ---------- Modais ----------
function abrirModalMovimentacao() {
  const opcoes = produtosCache.map(p => `<option value="${p.id}">${p.nome} (${p.quantidade} ${p.unidadeMedida} em estoque)</option>`).join("");
  abrirModal(`
    <div class="modal-title">Nova movimentação</div>
    <form id="movForm">
      <div class="field"><label>Produto</label><select id="movProduto" required>${opcoes || "<option>Nenhum produto cadastrado</option>"}</select></div>
      <div class="field"><label>Tipo</label>
        <select id="movTipo" required>
          <option value="entrada">Entrada</option><option value="saida">Saída</option>
          <option value="transferencia">Transferência</option><option value="ajuste">Ajuste</option>
          <option value="devolucao">Devolução</option><option value="emprestimo">Empréstimo</option>
        </select>
      </div>
      <div class="field"><label>Quantidade</label><input type="number" id="movQtd" min="0" step="0.01" required></div>
      <div class="field"><label>Motivo</label><input type="text" id="movMotivo" placeholder="Ex: Requisição produção"></div>
      <div class="field"><label>Documento (opcional)</label><input type="text" id="movDoc" placeholder="Ex: REQ-1187"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn primary">Registrar</button>
      </div>
    </form>
  `);
  document.getElementById("movForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("POST", "/movimentacoes", {
        produtoId: parseInt(document.getElementById("movProduto").value, 10),
        tipo: document.getElementById("movTipo").value,
        quantidade: parseFloat(document.getElementById("movQtd").value),
        motivo: document.getElementById("movMotivo").value,
        documento: document.getElementById("movDoc").value
      });
      fecharModal();
      mostrarToast("Movimentação registrada.", "success");
      trocarView("movimentacoes");
    } catch (err) {
      mostrarToast(err.message, "error");
    }
  });
}

function abrirModalProduto() {
  abrirModal(`
    <div class="modal-title">Cadastrar produto</div>
    <form id="prodForm">
      <div class="field"><label>Nome</label><input type="text" id="pNome" required></div>
      <div class="field"><label>Código interno</label><input type="text" id="pCodigo" required></div>
      <div class="field"><label>Categoria</label><input type="text" id="pCategoria" placeholder="Ex: Elétrica"></div>
      <div class="field"><label>Localização física</label><input type="text" id="pLocal" placeholder="Ex: R03-CA-P12"></div>
      <div class="field"><label>Quantidade inicial</label><input type="number" id="pQtd" min="0" value="0"></div>
      <div class="field"><label>Estoque mínimo</label><input type="number" id="pMin" min="0" value="0"></div>
      <div class="field"><label>Valor unitário (R$)</label><input type="number" id="pValor" min="0" step="0.01" value="0"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn primary">Cadastrar</button>
      </div>
    </form>
  `);
  
  document.getElementById("prodForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("POST", "/produtos", {
        nome: document.getElementById("pNome").value,
        codigoInterno: document.getElementById("pCodigo").value,
        categoria: document.getElementById("pCategoria").value,
        localizacao: document.getElementById("pLocal").value,
        quantidade: parseFloat(document.getElementById("pQtd").value || 0),
        estoqueMinimo: parseFloat(document.getElementById("pMin").value || 0),
        valorUnitario: parseFloat(document.getElementById("pValor").value || 0)
      });
      fecharModal();
      mostrarToast("Produto cadastrado.", "success");
      trocarView("estoque");
    } catch (err) {
      mostrarToast(err.message, "error");
    }
  });
}

function abrirModal(html) {
  fecharModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalOverlay";
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) fecharModal(); });
  document.body.appendChild(overlay);
}
function fecharModal() {
  const el = document.getElementById("modalOverlay");
  if (el) el.remove();
}

function abrirModalFuncionario() {
  abrirModal(`
    <div class="modal-title">Cadastrar Funcionário</div>

    <form id="funcForm">

      <div class="field">
        <label>Nome Completo</label>
        <input type="text" id="fNome" required>
      </div>

      <div class="field">
        <label>Usuário</label>
        <input type="text" id="fUsuario" required>
      </div>

      <div class="field">
        <label>Senha</label>
        <input type="password" id="fSenha" required>
      </div>

      <div class="field">
        <label>Papel</label>
        <select id="fPapel">
            <option value="operador">Operador</option>
            <option value="supervisor">Supervisor</option>
            <option value="administrador">Administrador</option>
            <option value="auditor">Auditor</option>
        </select>
      </div>

      <div class="field">
        <label>Setor</label>
        <input type="text" id="fSetor">
      </div>

      <div class="field">
        <label>E-mail</label>
        <input type="email" id="fEmail">
      </div>

      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">
            Cancelar
        </button>

        <button type="submit" class="btn primary">
            Cadastrar
        </button>
      </div>

    </form>
  `);

  

  document.getElementById("funcForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {

      await api("POST", "/usuarios", {

        nome: document.getElementById("fNome").value,
        usuario: document.getElementById("fUsuario").value,
        senha: document.getElementById("fSenha").value,
        papel: document.getElementById("fPapel").value,
        setor: document.getElementById("fSetor").value,
        email: document.getElementById("fEmail").value

      });

      fecharModal();

      mostrarToast("Funcionário cadastrado com sucesso.", "success");

      trocarView("funcionarios");

    } catch (err) {

      mostrarToast(err.message, "error");

    }

  });

}

// ---------- Utilidades ----------
function badgeTipo(tipo) {
  const map = { entrada: "saudavel", saida: "excesso", transferencia: "critico", ajuste: "vencido", devolucao: "excesso", emprestimo: "critico" };
  return `<span class="badge ${map[tipo] || 'saudavel'}"><i></i>${tipoLabel[tipo] || tipo}</span>`;
}
function sinalQtd(tipo) {
  if (["entrada", "devolucao"].includes(tipo)) return "+";
  if (["saida", "emprestimo", "transferencia"].includes(tipo)) return "-";
  return "";
}
function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function mostrarToast(msg, tipo) {
  const t = document.createElement("div");
  t.className = "toast " + tipo;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
