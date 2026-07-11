// js/app.js

const icons = {
  box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18l6-13 4 8 3-5 5 10z"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8h.01M11 12h1v5h1"/><circle cx="12" cy="12" r="9"/></svg>'
};
const statusLabel = { saudavel:"Saudável", critico:"Crítico", falta:"Em falta", vencido:"Vencido", vence_em_breve:"Vence em breve", excesso:"Excesso" };
const tipoLabel = { entrada:"Entrada", saida:"Saída", transferencia:"Transferência", ajuste:"Ajuste", devolucao:"Devolução", emprestimo:"Empréstimo", inventario:"Inventário" };
const setorLabel = { almoxarifado_central:"Almoxarifado central", producao:"Produção", manutencao:"Manutenção", escritorio:"Escritório", ferramentaria:"Ferramentaria" };

let usuarioAtual = null;
let produtosCache = [];
let fornecedoresCache = [];
let notasFiscaisCache = [];

// ---------- Boot ----------
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginForm").addEventListener("submit", tratarLogin);
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => trocarView(item.dataset.view));
  });
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("menuToggle").addEventListener("click", toggleSidebar);
  document.getElementById("sidebarOverlay").addEventListener("click", fecharSidebar);
  document.getElementById("btnNovaMovimentacao").addEventListener("click", abrirModalMovimentacao);
  document.getElementById("btnNovoProduto").addEventListener("click", () => abrirModalProduto());
  document.getElementById("btnNovoFuncionario").addEventListener("click", abrirModalFuncionario);
  document.getElementById("stockSearch").addEventListener("input", filtrarEstoque);
  document.getElementById("btnNovoFornecedor").addEventListener("click", () => abrirModalFornecedor());
  document.getElementById("fornecedorSearch").addEventListener("input", filtrarFornecedores);
  document.getElementById("stockSetorFiltro").addEventListener("change", filtrarEstoque);
  document.getElementById("btnRegistrarEntrada").addEventListener("click", () => abrirModalEntrada());
  document.getElementById("xmlFileInput").addEventListener("change", tratarUploadXml);
  document.getElementById("btnLancarNotaManual").addEventListener("click", abrirModalNotaManual);
  document.getElementById("notaSearch").addEventListener("input", filtrarNotas);

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

  // Botões de ação restritos por papel
  document.getElementById("btnNovoFuncionario").classList.toggle("hidden", usuarioAtual.papel !== "administrador");
  document.getElementById("btnNovoProduto").classList.toggle("hidden", !["administrador","supervisor","almoxarife"].includes(usuarioAtual.papel));
  document.getElementById("btnNovoFornecedor").classList.toggle("hidden", !["administrador","supervisor","compras"].includes(usuarioAtual.papel));

  const podeLancarNota = ["administrador","supervisor","almoxarife","compras"].includes(usuarioAtual.papel);
  document.getElementById("btnLancarNotaManual").classList.toggle("hidden", !podeLancarNota);
  document.querySelector('label[for="xmlFileInput"]').classList.toggle("hidden", !podeLancarNota);
  document.getElementById("btnRegistrarEntrada").classList.toggle("hidden", !podeLancarNota);

  trocarView("dashboard");
}

function iniciais(nome) {
  return nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

// ---------- Menu mobile ----------
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("open");
}
function fecharSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

// ---------- Navegação ----------
async function trocarView(view) {
  document.querySelectorAll(".nav-item").forEach(i => i.classList.toggle("active", i.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  fecharSidebar();

  try {
    if (view === "dashboard") await carregarDashboard();
    if (view === "estoque") await carregarEstoque();
    if (view === "fornecedores") await carregarFornecedores();
    if (view === "movimentacoes") await carregarMovimentacoes();
    if (view === "notasFiscais") await carregarNotasFiscais();
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
  const podeEditar = ["administrador", "supervisor", "almoxarife"].includes(usuarioAtual.papel);
  const podeExcluir = ["administrador", "supervisor"].includes(usuarioAtual.papel);
  const iconeEditar = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
  const iconeExcluir = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
  const iconeBaixa = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>';

  document.getElementById("stockTable").innerHTML = lista.length ? lista.map(p => `
    <tr>
      <td><div class="prod-cell">
        <div class="prod-thumb">${icons.box}</div>
        <div><div class="prod-name">${p.nome}</div><div class="prod-code">${p.codigoInterno} · ${p.categoria}${p.fornecedor ? ` · ${p.fornecedor}` : ""}</div></div>
      </div></td>
      <td>${setorLabel[p.setor] || p.setor || "—"}</td>
      <td>${p.localizacao ? `<span class="tag-loc">${p.localizacao}</span>` : "—"}</td>
      <td style="font-family:var(--font-mono); color:var(--text-secondary)">${p.lote || "—"}</td>
      <td class="qty-cell">${p.quantidade} ${p.unidadeMedida}</td>
      <td class="qty-cell" style="color:var(--text-muted)">${p.estoqueMinimo}</td>
      <td style="color:var(--text-secondary)">${p.validade || "—"}</td>
      <td><span class="badge ${p.status}"><i></i>${statusLabel[p.status] || p.status}</span></td>
      <td><div class="row-actions">
        <button class="icon-action baixa" title="Dar baixa (registrar retirada)" ${p.quantidade <= 0 ? "disabled" : ""} onclick="abrirModalBaixa(${p.id})">${iconeBaixa}</button>
        ${podeEditar ? `<button class="icon-action" title="Editar produto" onclick="editarProduto(${p.id})">${iconeEditar}</button>` : ""}
        ${podeExcluir ? `<button class="icon-action danger" title="Excluir produto" onclick="excluirProduto(${p.id})">${iconeExcluir}</button>` : ""}
      </div></td>
    </tr>`).join("") : '<tr class="empty-row"><td colspan="9">Nenhum produto encontrado.</td></tr>';
}

function normalizarTexto(texto) {
  return (texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function filtrarEstoque() {
  const q = normalizarTexto(document.getElementById("stockSearch").value);
  const setor = document.getElementById("stockSetorFiltro").value;
  renderEstoque(produtosCache.filter(p => {
    const bateBusca = !q || normalizarTexto(p.nome).includes(q) || normalizarTexto(p.codigoInterno).includes(q) ||
      normalizarTexto(p.lote).includes(q) || normalizarTexto(p.fornecedor).includes(q);
    const bateSetor = !setor || p.setor === setor;
    return bateBusca && bateSetor;
  }));
}

// ---------- Fornecedores ----------
async function carregarFornecedores() {
  fornecedoresCache = await api("GET", "/fornecedores");
  renderFornecedores(fornecedoresCache);
}

function renderFornecedores(lista) {
  const podeEditar = ["administrador", "supervisor", "compras"].includes(usuarioAtual.papel);
  const podeExcluir = ["administrador", "supervisor"].includes(usuarioAtual.papel);
  const iconeEditar = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
  const iconeExcluir = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';

  document.getElementById("fornecedorTable").innerHTML = lista.length ? lista.map(f => `
    <tr>
      <td><a href="#" onclick="abrirPerfilFornecedor(${f.id}); return false;" style="color:var(--text-primary); font-weight:500; text-decoration:none;" onmouseover="this.style.color='var(--accent-text)'" onmouseout="this.style.color='var(--text-primary)'">${f.nome}</a>${f.cnpj ? `<div class="prod-code">${f.cnpj}</div>` : ""}</td>
      <td>${f.categoria ? `<span class="badge saudavel"><i></i>${f.categoria}</span>` : "—"}</td>
      <td>${f.contato || "—"}</td>
      <td style="font-family:var(--font-mono); color:var(--text-secondary)">${f.telefone || "—"}</td>
      <td class="qty-cell" style="cursor:pointer;" onclick="abrirPerfilFornecedor(${f.id})">${f.totalProdutos} ${f.totalProdutos === 1 ? "produto" : "produtos"}</td>
      <td><div class="row-actions">
        ${podeEditar ? `<button class="icon-action" title="Editar fornecedor" onclick="editarFornecedor(${f.id})">${iconeEditar}</button>` : ""}
        ${podeExcluir ? `<button class="icon-action danger" title="Excluir fornecedor" onclick="excluirFornecedor(${f.id})">${iconeExcluir}</button>` : ""}
        ${!podeEditar && !podeExcluir ? "—" : ""}
      </div></td>
    </tr>`).join("") : '<tr class="empty-row"><td colspan="6">Nenhum fornecedor encontrado.</td></tr>';
}

function filtrarFornecedores(e) {
  const q = normalizarTexto(e.target.value);
  renderFornecedores(fornecedoresCache.filter(f =>
    normalizarTexto(f.nome).includes(q) ||
    normalizarTexto(f.cnpj || "").includes(q) ||
    normalizarTexto(f.contato || "").includes(q) ||
    normalizarTexto(f.categoria || "").includes(q)
  ));
}

async function abrirPerfilFornecedor(id) {
  try {
    const f = await api("GET", `/fornecedores/${id}`);
    const podeEditar = ["administrador", "supervisor", "compras"].includes(usuarioAtual.papel);

    abrirModal(`
      <div class="modal-title">${f.nome}</div>
      <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.9; margin-bottom:16px;">
        ${f.cnpj ? `<div><strong style="color:var(--text-primary)">CNPJ:</strong> ${f.cnpj}</div>` : ""}
        ${f.contato ? `<div><strong style="color:var(--text-primary)">Contato:</strong> ${f.contato}</div>` : ""}
        ${f.telefone ? `<div><strong style="color:var(--text-primary)">Telefone:</strong> ${f.telefone}</div>` : ""}
        ${f.email ? `<div><strong style="color:var(--text-primary)">E-mail:</strong> ${f.email}</div>` : ""}
        ${f.endereco ? `<div><strong style="color:var(--text-primary)">Endereço:</strong> ${f.endereco}</div>` : ""}
        ${f.categoria ? `<div><strong style="color:var(--text-primary)">Categoria:</strong> ${f.categoria}</div>` : ""}
        ${f.observacoes ? `<div><strong style="color:var(--text-primary)">Observações:</strong> ${f.observacoes}</div>` : ""}
      </div>
      <div class="panel-title" style="margin-bottom:8px;">Produtos deste fornecedor <span class="muted">${f.produtos.length}</span></div>
      <div style="max-height:220px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
        ${f.produtos.length ? f.produtos.map(p => `
          <div style="display:flex; align-items:center; gap:10px; padding:9px 12px; border-bottom:1px solid var(--border);">
            <div class="prod-thumb" style="width:26px;height:26px;">${icons.box}</div>
            <div style="flex:1;"><div class="prod-name">${p.nome}</div><div class="prod-code">${p.codigoInterno}</div></div>
            <span class="badge ${p.quantidade <= 0 ? 'falta' : (p.quantidade < p.estoqueMinimo ? 'critico' : 'saudavel')}"><i></i>${p.quantidade} ${p.unidadeMedida}</span>
          </div>`).join("") : '<div style="padding:14px; color:var(--text-muted); font-size:12.5px;">Nenhum produto vinculado a este fornecedor ainda.</div>'}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Fechar</button>
        ${podeEditar ? `<button type="button" class="btn primary" onclick="fecharModal(); editarFornecedor(${f.id})">Editar fornecedor</button>` : ""}
      </div>
    `);
  } catch (err) {
    mostrarToast(err.message, "error");
  }
}

function abrirModalFornecedor(fornecedor) {
  const editando = !!fornecedor;
  abrirModal(`
    <div class="modal-title">${editando ? "Editar fornecedor" : "Cadastrar fornecedor"}</div>
    <form id="fornForm">
      <div class="field"><label>Nome</label><input type="text" id="fnNome" value="${fornecedor ? fornecedor.nome : ""}" required></div>
      <div class="field"><label>CNPJ</label><input type="text" id="fnCnpj" placeholder="00.000.000/0000-00" value="${fornecedor ? (fornecedor.cnpj || "") : ""}"></div>
      <div class="field"><label>Categoria</label><input type="text" id="fnCategoria" placeholder="Ex: Elétrica" value="${fornecedor ? (fornecedor.categoria || "") : ""}"></div>
      <div class="field"><label>Nome do contato</label><input type="text" id="fnContato" value="${fornecedor ? (fornecedor.contato || "") : ""}"></div>
      <div class="field"><label>Telefone</label><input type="text" id="fnTelefone" value="${fornecedor ? (fornecedor.telefone || "") : ""}"></div>
      <div class="field"><label>E-mail</label><input type="email" id="fnEmail" value="${fornecedor ? (fornecedor.email || "") : ""}"></div>
      <div class="field"><label>Endereço</label><input type="text" id="fnEndereco" value="${fornecedor ? (fornecedor.endereco || "") : ""}"></div>
      <div class="field"><label>Observações</label><input type="text" id="fnObs" value="${fornecedor ? (fornecedor.observacoes || "") : ""}"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn primary">${editando ? "Salvar alterações" : "Cadastrar"}</button>
      </div>
    </form>
  `);
  document.getElementById("fornForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nome: document.getElementById("fnNome").value,
      cnpj: document.getElementById("fnCnpj").value,
      categoria: document.getElementById("fnCategoria").value,
      contato: document.getElementById("fnContato").value,
      telefone: document.getElementById("fnTelefone").value,
      email: document.getElementById("fnEmail").value,
      endereco: document.getElementById("fnEndereco").value,
      observacoes: document.getElementById("fnObs").value
    };
    try {
      if (editando) {
        await api("PUT", `/fornecedores/${fornecedor.id}`, payload);
        mostrarToast("Fornecedor atualizado.", "success");
      } else {
        await api("POST", "/fornecedores", payload);
        mostrarToast("Fornecedor cadastrado.", "success");
      }
      fecharModal();
      trocarView("fornecedores");
    } catch (err) {
      mostrarToast(err.message, "error");
    }
  });
}

async function editarFornecedor(id) {
  let fornecedor = fornecedoresCache.find(f => f.id === id);
  if (!fornecedor) {
    try { fornecedor = await api("GET", `/fornecedores/${id}`); } catch (err) { mostrarToast(err.message, "error"); return; }
  }
  abrirModalFornecedor(fornecedor);
}

async function excluirFornecedor(id) {
  const fornecedor = fornecedoresCache.find(f => f.id === id);
  if (!fornecedor) return;
  if (!confirm(`Excluir o fornecedor "${fornecedor.nome}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await api("DELETE", `/fornecedores/${id}`);
    mostrarToast("Fornecedor excluído.", "success");
    trocarView("fornecedores");
  } catch (err) {
    mostrarToast(err.message, "error");
  }
}

// ---------- Movimentações ----------
async function carregarMovimentacoes() {
  const lista = await api("GET", "/movimentacoes");
  document.getElementById("movesTable").innerHTML = lista.length ? lista.map(m => `
    <tr>
      <td style="font-family:var(--font-mono); color:var(--text-secondary)">${formatarData(m.dataHora)}</td>
      <td>${m.produtoNome}</td><td>${badgeTipo(m.tipo)}</td>
      <td class="qty-cell">${sinalQtd(m.tipo)}${m.quantidade}</td><td>${m.usuarioNome}</td>
      <td>${m.retiradoPor || "—"}</td>
      <td>${m.motivo || "—"}</td>
      <td style="font-family:var(--font-mono); color:var(--text-muted)">${m.documento || "—"}</td>
    </tr>`).join("") : '<tr class="empty-row"><td colspan="8">Nenhuma movimentação registrada.</td></tr>';
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
  const ehAdmin = usuarioAtual.papel === "administrador";
  const iconeExcluir = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';

  document.getElementById("funcTable").innerHTML = lista.map(u => `
    <tr>
      <td><div class="prod-cell"><div class="avatar" style="width:28px;height:28px;font-size:11px;">${iniciais(u.nome)}</div><div class="prod-name">${u.nome}</div></div></td>
      <td>${u.usuario}</td>
      <td><span class="badge saudavel"><i></i>${u.papel}</span></td>
      <td>${u.setor || "—"}</td>
      <td>${u.twoFactorAtivo ? "Ativo" : "Inativo"}</td>
      <td>${ehAdmin
        ? (u.id === usuarioAtual.id
          ? '<span style="color:var(--text-muted); font-size:11.5px;">você</span>'
          : `<div class="row-actions"><button class="icon-action danger" title="Excluir funcionário" onclick="excluirFuncionario(${u.id})">${iconeExcluir}</button></div>`)
        : "—"}</td>
    </tr>`).join("");
}

async function excluirFuncionario(id) {
  if (!confirm("Excluir este funcionário? Ele perderá o acesso ao sistema imediatamente. Esta ação não pode ser desfeita.")) return;
  try {
    await api("DELETE", `/usuarios/${id}`);
    mostrarToast("Funcionário removido.", "success");
    trocarView("funcionarios");
  } catch (err) {
    mostrarToast(err.message, "error");
  }
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
function abrirModalBaixa(produtoId) {
  const produto = produtosCache.find(p => p.id === produtoId);
  if (!produto) { mostrarToast("Produto não encontrado.", "error"); return; }
  if (produto.quantidade <= 0) { mostrarToast("Este produto está com estoque zerado.", "error"); return; }

  abrirModal(`
    <div class="modal-title">Dar baixa — ${produto.nome}</div>
    <p style="font-size:12.5px; color:var(--text-secondary); margin:-8px 0 16px;">
      Disponível em estoque: <strong style="color:var(--text-primary)">${produto.quantidade} ${produto.unidadeMedida}</strong>
      ${produto.localizacao ? ` · <span class="tag-loc">${produto.localizacao}</span>` : ""}
    </p>
    <form id="baixaForm">
      <div class="field"><label>Quantidade retirada</label><input type="number" id="bxQtd" min="0.01" max="${produto.quantidade}" step="0.01" value="1" required autofocus></div>
      <div class="field"><label>Retirado por</label><input type="text" id="bxRetiradoPor" placeholder="Nome de quem está levando"></div>
      <div class="field"><label>Setor de destino</label>
        <select id="bxSetor">
          <option value="">Não informado</option>
          <option value="producao">Produção</option>
          <option value="manutencao">Manutenção</option>
          <option value="escritorio">Escritório</option>
          <option value="ferramentaria">Ferramentaria</option>
          <option value="almoxarifado_central">Almoxarifado central</option>
        </select>
      </div>
      <div class="field"><label>Motivo (opcional)</label><input type="text" id="bxMotivo" placeholder="Ex: Uso na linha 2"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn primary">Confirmar baixa</button>
      </div>
    </form>
  `);

  document.getElementById("baixaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const quantidade = parseFloat(document.getElementById("bxQtd").value);
    if (!quantidade || quantidade <= 0) {
      mostrarToast("Informe uma quantidade válida.", "error");
      return;
    }
    if (quantidade > produto.quantidade) {
      mostrarToast(`Quantidade maior que o disponível (${produto.quantidade} ${produto.unidadeMedida}).`, "error");
      return;
    }
    try {
      await api("POST", "/movimentacoes", {
        produtoId: produto.id,
        tipo: "saida",
        quantidade,
        retiradoPor: document.getElementById("bxRetiradoPor").value,
        setorDestino: document.getElementById("bxSetor").value,
        motivo: document.getElementById("bxMotivo").value || "Retirada de estoque"
      });
      fecharModal();
      mostrarToast("Baixa registrada com sucesso.", "success");
      trocarView("estoque");
    } catch (err) {
      mostrarToast(err.message, "error");
    }
  });
}

async function abrirModalEntrada() {
  if (!produtosCache.length) {
    try { produtosCache = await api("GET", "/produtos"); } catch (err) { mostrarToast(err.message, "error"); return; }
  }
  if (!produtosCache.length) {
    mostrarToast("Cadastre ao menos um produto antes de registrar uma entrada.", "error");
    return;
  }

  const opcoesProduto = produtosCache.map(p =>
    `<option value="${p.id}">${p.nome} (${p.quantidade} ${p.unidadeMedida} em estoque)</option>`
  ).join("");

  abrirModal(`
    <div class="modal-title">Registrar entrada</div>
    <p style="font-size:12.5px; color:var(--text-secondary); margin:-8px 0 16px;">
      Para entradas vindas de compra com nota fiscal, use a aba <strong style="color:var(--text-primary)">Notas Fiscais</strong> — ela atualiza tudo automaticamente. Use esta opção para entradas avulsas (ex: devolução, ajuste manual).
    </p>
    <form id="entradaForm">
      <div class="field"><label>Produto</label><select id="enProduto" required><option value="">Selecione…</option>${opcoesProduto}</select></div>
      <div class="field"><label>Quantidade</label><input type="number" id="enQtd" min="0.01" step="0.01" required></div>
      <div class="field"><label>Documento (opcional)</label><input type="text" id="enDocumento" placeholder="Ex: NF-1234 ou comprovante"></div>
      <div class="field"><label>Motivo</label><input type="text" id="enMotivo" placeholder="Ex: Devolução de material"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn primary">Confirmar entrada</button>
      </div>
    </form>
  `);

  document.getElementById("entradaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const quantidade = parseFloat(document.getElementById("enQtd").value);
    if (!quantidade || quantidade <= 0) {
      mostrarToast("Informe uma quantidade válida.", "error");
      return;
    }
    try {
      await api("POST", "/movimentacoes", {
        produtoId: parseInt(document.getElementById("enProduto").value, 10),
        tipo: "entrada",
        quantidade,
        documento: document.getElementById("enDocumento").value,
        motivo: document.getElementById("enMotivo").value || "Entrada avulsa"
      });
      fecharModal();
      mostrarToast("Entrada registrada com sucesso.", "success");
      trocarView("estoque");
    } catch (err) {
      mostrarToast(err.message, "error");
    }
  });
}

// ---------- Notas Fiscais ----------
async function carregarNotasFiscais() {
  notasFiscaisCache = await api("GET", "/notas-fiscais");
  renderNotasFiscais(notasFiscaisCache);
}

function renderNotasFiscais(lista) {
  document.getElementById("notaTable").innerHTML = lista.length ? lista.map(n => `
    <tr>
      <td style="font-family:var(--font-mono);">${n.numero}${n.serie ? `/${n.serie}` : ""}</td>
      <td>${n.fornecedor}</td>
      <td style="color:var(--text-secondary)">${n.dataEmissao ? formatarData(n.dataEmissao) : "—"}</td>
      <td class="qty-cell">R$ ${Number(n.valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
      <td class="qty-cell">${n.itens.length}</td>
      <td><span class="badge ${n.origem === 'xml' ? 'info' : 'saudavel'}"><i></i>${n.origem === 'xml' ? 'XML' : 'Manual'}</span></td>
      <td>${n.usuarioNome}</td>
    </tr>`).join("") : '<tr class="empty-row"><td colspan="7">Nenhuma nota fiscal lançada ainda.</td></tr>';
}

function filtrarNotas(e) {
  const q = normalizarTexto(e.target.value);
  renderNotasFiscais(notasFiscaisCache.filter(n =>
    normalizarTexto(n.numero).includes(q) || normalizarTexto(n.fornecedor).includes(q) || normalizarTexto(n.chaveAcesso || "").includes(q)
  ));
}

async function tratarUploadXml(e) {
  const file = e.target.files[0];
  if (!file) return;

  const texto = await file.text();
  try {
    const preview = await api("POST", "/notas-fiscais/importar-xml", { xml: texto });
    if (!fornecedoresCache.length) fornecedoresCache = await api("GET", "/fornecedores");
    if (!produtosCache.length) produtosCache = await api("GET", "/produtos");
    abrirPrevisaoNota(preview, "xml");
  } catch (err) {
    mostrarToast(err.message, "error");
  } finally {
    e.target.value = ""; // permite reimportar o mesmo arquivo depois, se preciso
  }
}

async function abrirModalNotaManual() {
  if (!fornecedoresCache.length) fornecedoresCache = await api("GET", "/fornecedores");
  if (!produtosCache.length) produtosCache = await api("GET", "/produtos");
  if (!fornecedoresCache.length) {
    mostrarToast("Cadastre ao menos um fornecedor antes de lançar uma nota.", "error");
    return;
  }
  abrirPrevisaoNota({
    numero: "", serie: "", dataEmissao: new Date().toISOString().slice(0, 10), valorTotal: 0,
    chaveAcesso: null, fornecedor: { nome: "", cnpj: "" }, fornecedorId: null, itens: []
  }, "manual");
}

let itensNotaAtual = [];

function abrirPrevisaoNota(preview, origem) {
  itensNotaAtual = (preview.itens || []).map(it => ({ ...it }));

  const opcoesFornecedor = fornecedoresCache.map(f =>
    `<option value="${f.id}" ${preview.fornecedorId === f.id ? "selected" : ""}>${f.nome}</option>`
  ).join("");

  abrirModal(`
    <div class="modal-title">${origem === "xml" ? "Confirmar importação da NF-e" : "Lançar nota fiscal manual"}</div>
    ${origem === "xml" ? `<p style="font-size:12.5px; color:var(--text-secondary); margin:-8px 0 14px;">Confira os dados extraídos do XML antes de confirmar. Itens sem produto correspondente pedem que você vincule ou cadastre um novo.</p>` : ""}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div class="field"><label>Número da nota</label><input type="text" id="nfNumero" value="${preview.numero || ""}" required></div>
      <div class="field"><label>Série</label><input type="text" id="nfSerie" value="${preview.serie || ""}"></div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div class="field"><label>Data de emissão</label><input type="date" id="nfData" value="${(preview.dataEmissao || "").slice(0, 10)}"></div>
      <div class="field"><label>Valor total (R$)</label><input type="number" id="nfValor" min="0" step="0.01" value="${preview.valorTotal || 0}"></div>
    </div>

    <div class="field">
      <label>Fornecedor</label>
      ${fornecedoresCache.length ? `
        <select id="nfFornecedor" onchange="document.getElementById('nfFornecedorNovoBox').classList.toggle('hidden', this.value !== '__novo__')">
          <option value="">Selecione…</option>
          ${opcoesFornecedor}
          <option value="__novo__" ${!preview.fornecedorId ? "selected" : ""}>+ Cadastrar novo fornecedor</option>
        </select>` : `<input type="hidden" id="nfFornecedor" value="__novo__">`}
    </div>
    <div id="nfFornecedorNovoBox" class="${preview.fornecedorId ? "hidden" : ""}" style="background:var(--bg-panel-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin:-6px 0 14px;">
      <div class="field" style="margin-bottom:8px;"><label>Nome do novo fornecedor</label><input type="text" id="nfNovoNome" value="${preview.fornecedor ? (preview.fornecedor.nome || "") : ""}"></div>
      <div class="field" style="margin-bottom:0;"><label>CNPJ</label><input type="text" id="nfNovoCnpj" value="${preview.fornecedor ? (preview.fornecedor.cnpj || "") : ""}"></div>
    </div>

    <div class="panel-title" style="margin-bottom:8px;">Itens da nota <span class="muted" id="nfItensCount"></span></div>
    <div id="nfItensLista"></div>
    ${origem === "manual" ? `<button type="button" class="btn" style="margin-top:8px;" onclick="adicionarItemNota()">+ Adicionar item</button>` : ""}

    <div class="modal-actions">
      <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
      <button type="button" class="btn primary" onclick="confirmarNota('${origem}')">Confirmar e lançar nota</button>
    </div>
  `);

  renderItensNota();
}

function renderItensNota() {
  const opcoesProdutoBase = produtosCache.map(p => `<option value="${p.id}">${p.nome} (${p.codigoInterno})</option>`).join("");

  document.getElementById("nfItensCount").textContent = `${itensNotaAtual.length} ${itensNotaAtual.length === 1 ? "item" : "itens"}`;
  document.getElementById("nfItensLista").innerHTML = itensNotaAtual.length ? itensNotaAtual.map((item, i) => `
    <div style="border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px;">
      <div style="display:flex; gap:8px; align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-size:12.5px; font-weight:500;">${item.descricao || "(sem descrição)"}</div>
          <div class="prod-code">Código na nota: ${item.codigoInterno || "—"}${item.codigoBarras ? ` · EAN ${item.codigoBarras}` : ""}</div>
        </div>
        <button type="button" class="icon-action danger" title="Remover item" onclick="removerItemNota(${i})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:8px;">
        <div class="field" style="margin-bottom:0;"><label>Quantidade</label><input type="number" min="0.01" step="0.01" value="${item.quantidade}" data-item-field="quantidade" data-item-index="${i}"></div>
        <div class="field" style="margin-bottom:0;"><label>Valor unitário (R$)</label><input type="number" min="0" step="0.01" value="${item.valorUnitario || 0}" data-item-field="valorUnitario" data-item-index="${i}"></div>
        <div class="field" style="margin-bottom:0;"><label>Unidade</label><input type="text" value="${item.unidadeMedida || 'un'}" data-item-field="unidadeMedida" data-item-index="${i}"></div>
      </div>
      <div class="field" style="margin:8px 0 0;">
        <label>Produto no sistema</label>
        <select data-item-produto="${i}" onchange="alternarNovoProdutoItem(${i}, this.value)">
          <option value="">— vincular a um produto existente —</option>
          ${opcoesProdutoBase}
          <option value="__novo__" ${!item.produtoId ? "selected" : ""}>+ Cadastrar produto novo</option>
        </select>
        ${item.produtoId ? `<div style="font-size:11.5px; color:var(--success-text); margin-top:4px;">✓ Vinculado automaticamente a "${item.produtoNomeAtual}" (estoque atual: ${item.quantidadeAtualEstoque})</div>` : ""}
      </div>
      <div data-novo-produto-box="${i}" class="${item.produtoId ? 'hidden' : ''}" style="background:var(--bg-panel-2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-top:8px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field" style="margin-bottom:8px;"><label>Nome do produto</label><input type="text" value="${item.descricao || ''}" data-item-field="novoNome" data-item-index="${i}"></div>
          <div class="field" style="margin-bottom:8px;"><label>Código interno</label><input type="text" value="${item.codigoInterno || ''}" data-item-field="novoCodigo" data-item-index="${i}"></div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field" style="margin-bottom:0;"><label>Categoria</label><input type="text" placeholder="Ex: Elétrica" data-item-field="novaCategoria" data-item-index="${i}"></div>
          <div class="field" style="margin-bottom:0;"><label>Estoque mínimo</label><input type="number" min="0" value="0" data-item-field="novoMinimo" data-item-index="${i}"></div>
        </div>
      </div>
    </div>
  `).join("") : '<p style="color:var(--text-muted); font-size:12.5px;">Nenhum item ainda. Use "Adicionar item" abaixo.</p>';

  // Pré-seleciona o produto correspondente quando o item já veio casado do XML
  itensNotaAtual.forEach((item, i) => {
    if (item.produtoId) {
      const sel = document.querySelector(`[data-item-produto="${i}"]`);
      if (sel) sel.value = String(item.produtoId);
    }
  });
}

function alternarNovoProdutoItem(index, valor) {
  itensNotaAtual[index].produtoId = (valor && valor !== "__novo__") ? parseInt(valor, 10) : null;
  const box = document.querySelector(`[data-novo-produto-box="${index}"]`);
  if (box) box.classList.toggle("hidden", !!itensNotaAtual[index].produtoId);
}

function adicionarItemNota() {
  itensNotaAtual.push({ codigoInterno: "", codigoBarras: null, descricao: "", unidadeMedida: "un", quantidade: 1, valorUnitario: 0, produtoId: null });
  renderItensNota();
}

function removerItemNota(index) {
  itensNotaAtual.splice(index, 1);
  renderItensNota();
}

async function confirmarNota(origem) {
  // Sincroniza os valores editados dos campos de cada item de volta em itensNotaAtual
  document.querySelectorAll("[data-item-field]").forEach(input => {
    const i = parseInt(input.dataset.itemIndex, 10);
    const campo = input.dataset.itemField;
    if (campo === "quantidade" || campo === "valorUnitario" || campo === "novoMinimo") {
      itensNotaAtual[i][campo] = parseFloat(input.value || 0);
    } else {
      itensNotaAtual[i][campo] = input.value;
    }
  });

  const numero = document.getElementById("nfNumero").value.trim();
  if (!numero) { mostrarToast("Informe o número da nota.", "error"); return; }
  if (!itensNotaAtual.length) { mostrarToast("Adicione ao menos um item à nota.", "error"); return; }

  const fornecedorSelect = document.getElementById("nfFornecedor").value;
  let fornecedorId = null;
  let fornecedorNovo = null;
  if (fornecedorSelect === "__novo__") {
    const nome = document.getElementById("nfNovoNome").value.trim();
    if (!nome) { mostrarToast("Informe o nome do novo fornecedor.", "error"); return; }
    fornecedorNovo = { nome, cnpj: document.getElementById("nfNovoCnpj").value.trim() };
  } else if (fornecedorSelect) {
    fornecedorId = parseInt(fornecedorSelect, 10);
  } else {
    mostrarToast("Selecione ou cadastre um fornecedor.", "error");
    return;
  }

  const itensPayload = itensNotaAtual.map(item => {
    const base = {
      codigoInterno: item.produtoId ? undefined : (item.novoCodigo || item.codigoInterno),
      codigoBarras: item.codigoBarras || null,
      descricao: item.descricao,
      unidadeMedida: item.unidadeMedida || "un",
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: (item.quantidade || 0) * (item.valorUnitario || 0)
    };
    if (item.produtoId) {
      base.produtoId = item.produtoId;
      base.codigoInterno = item.codigoInterno;
    } else {
      base.criarProduto = {
        nome: item.novoNome || item.descricao,
        categoria: item.novaCategoria || "geral",
        estoqueMinimo: item.novoMinimo || 0
      };
    }
    return base;
  });

  try {
    await api("POST", "/notas-fiscais", {
      numero,
      serie: document.getElementById("nfSerie").value,
      dataEmissao: document.getElementById("nfData").value,
      valorTotal: parseFloat(document.getElementById("nfValor").value || 0),
      chaveAcesso: null,
      fornecedorId,
      fornecedorNovo,
      origem,
      itens: itensPayload
    });
    fecharModal();
    mostrarToast("Nota lançada! Estoque atualizado automaticamente.", "success");
    fornecedoresCache = []; // força recarregar (pode ter fornecedor novo)
    produtosCache = []; // força recarregar (pode ter produto novo)
    trocarView("notasFiscais");
  } catch (err) {
    mostrarToast(err.message, "error");
  }
}

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

async function abrirModalProduto(produto) {
  const editando = !!produto;

  // Garante que a lista de fornecedores está carregada antes de montar o select
  if (!fornecedoresCache.length) {
    try { fornecedoresCache = await api("GET", "/fornecedores"); } catch (err) { mostrarToast(err.message, "error"); return; }
  }
  if (!fornecedoresCache.length) {
    mostrarToast("Cadastre ao menos um fornecedor antes de cadastrar produtos.", "error");
    return;
  }

  const opcoesFornecedor = fornecedoresCache.map(f =>
    `<option value="${f.id}" ${produto && produto.fornecedorId === f.id ? "selected" : ""}>${f.nome}</option>`
  ).join("");

  abrirModal(`
    <div class="modal-title">${editando ? "Editar produto" : "Cadastrar produto"}</div>
    <form id="prodForm">
      <div class="field"><label>Nome</label><input type="text" id="pNome" value="${produto ? produto.nome : ""}" required></div>
      <div class="field"><label>Código interno</label><input type="text" id="pCodigo" value="${produto ? produto.codigoInterno : ""}" ${editando ? "disabled" : ""} required></div>
      <div class="field"><label>Fornecedor</label>
        <select id="pFornecedor" required>
          <option value="">Selecione o fornecedor…</option>
          ${opcoesFornecedor}
        </select>
      </div>
      <div class="field"><label>Categoria</label><input type="text" id="pCategoria" placeholder="Ex: Elétrica" value="${produto ? (produto.categoria || "") : ""}"></div>
      <div class="field"><label>Setor</label>
        <select id="pSetor">
          <option value="almoxarifado_central" ${produto && produto.setor === "almoxarifado_central" ? "selected" : ""}>Almoxarifado central</option>
          <option value="producao" ${produto && produto.setor === "producao" ? "selected" : ""}>Produção</option>
          <option value="manutencao" ${produto && produto.setor === "manutencao" ? "selected" : ""}>Manutenção</option>
          <option value="escritorio" ${produto && produto.setor === "escritorio" ? "selected" : ""}>Escritório</option>
          <option value="ferramentaria" ${produto && produto.setor === "ferramentaria" ? "selected" : ""}>Ferramentaria</option>
        </select>
      </div>
      <div class="field"><label>Localização física</label><input type="text" id="pLocal" placeholder="Ex: R03-CA-P12" value="${produto ? (produto.localizacao || "") : ""}"></div>
      <div class="field"><label>Quantidade${editando ? " atual" : " inicial"}</label><input type="number" id="pQtd" min="0" value="${produto ? produto.quantidade : 0}"></div>
      <div class="field"><label>Estoque mínimo</label><input type="number" id="pMin" min="0" value="${produto ? produto.estoqueMinimo : 0}"></div>
      <div class="field"><label>Valor unitário (R$)</label><input type="number" id="pValor" min="0" step="0.01" value="${produto ? produto.valorUnitario : 0}"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn primary">${editando ? "Salvar alterações" : "Cadastrar"}</button>
      </div>
    </form>
  `);
  document.getElementById("prodForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fornecedorId = document.getElementById("pFornecedor").value;
    if (!fornecedorId) {
      mostrarToast("Selecione o fornecedor do produto.", "error");
      return;
    }
    const payload = {
      nome: document.getElementById("pNome").value,
      fornecedorId: parseInt(fornecedorId, 10),
      categoria: document.getElementById("pCategoria").value,
      setor: document.getElementById("pSetor").value,
      localizacao: document.getElementById("pLocal").value,
      quantidade: parseFloat(document.getElementById("pQtd").value || 0),
      estoqueMinimo: parseFloat(document.getElementById("pMin").value || 0),
      valorUnitario: parseFloat(document.getElementById("pValor").value || 0)
    };
    try {
      if (editando) {
        await api("PUT", `/produtos/${produto.id}`, payload);
        mostrarToast("Produto atualizado.", "success");
      } else {
        payload.codigoInterno = document.getElementById("pCodigo").value;
        await api("POST", "/produtos", payload);
        mostrarToast("Produto cadastrado.", "success");
      }
      fecharModal();
      trocarView("estoque");
    } catch (err) {
      mostrarToast(err.message, "error");
    }
  });
}

async function editarProduto(id) {
  const produto = produtosCache.find(p => p.id === id);
  if (produto) abrirModalProduto(produto);
}

async function excluirProduto(id) {
  const produto = produtosCache.find(p => p.id === id);
  if (!produto) return;
  if (!confirm(`Excluir "${produto.nome}" do estoque? Esta ação não pode ser desfeita.`)) return;
  try {
    await api("DELETE", `/produtos/${id}`);
    mostrarToast("Produto excluído.", "success");
    trocarView("estoque");
  } catch (err) {
    mostrarToast(err.message, "error");
  }
}

function abrirModalFuncionario() {
  abrirModal(`
    <div class="modal-title">Novo funcionário</div>
    <form id="funcForm">
      <div class="field"><label>Nome completo</label><input type="text" id="fNome" required></div>
      <div class="field"><label>Usuário (login)</label><input type="text" id="fUsuario" required></div>
      <div class="field"><label>Senha provisória</label><input type="password" id="fSenha" minlength="6" required></div>
      <div class="field"><label>Cargo / nível de acesso</label>
        <select id="fPapel" required>
          <option value="administrador">Administrador</option>
          <option value="supervisor">Supervisor</option>
          <option value="almoxarife" selected>Almoxarife</option>
          <option value="compras">Compras</option>
          <option value="producao">Produção</option>
          <option value="auditor">Auditor</option>
        </select>
      </div>
      <div class="field"><label>Setor</label><input type="text" id="fSetor" placeholder="Ex: almoxarifado_central"></div>
      <div class="field"><label>Cargo (descrição)</label><input type="text" id="fCargo" placeholder="Ex: Almoxarife pleno"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn primary">Criar acesso</button>
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
        cargo: document.getElementById("fCargo").value
      });
      fecharModal();
      mostrarToast("Funcionário cadastrado. Repasse a senha provisória a ele com segurança.", "success");
      trocarView("funcionarios");
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
