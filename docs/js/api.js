// js/api.js
// A constante API_URL vem de config.js (carregado antes deste arquivo).

function getToken() { return localStorage.getItem("norta_token"); }
function setToken(t) { localStorage.setItem("norta_token", t); }
function clearToken() { localStorage.removeItem("norta_token"); }

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  let resp;
  try {
    resp = await fetch(API_URL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    // fetch() só cai aqui em falha de rede/CORS — a API pode estar fora do ar,
    // com a URL errada em config.js, ou bloqueada por CORS.
    throw new Error(`Não foi possível conectar à API em ${API_URL}. Verifique se o backend está rodando e se a URL em js/config.js está correta.`);
  }

  const textoResposta = await resp.text();
  let data = {};
  try {
    data = textoResposta ? JSON.parse(textoResposta) : {};
  } catch {
    // Resposta não veio em JSON — normalmente sinal de proxy/hospedagem
    // devolvendo uma página de erro (HTML) em vez da API responder.
    if (!resp.ok) {
      throw new Error(`Erro ${resp.status} ao chamar ${path}. A resposta do servidor não veio em JSON (verifique se o backend está atualizado e rodando).`);
    }
  }

  if (resp.status === 401 && path !== "/auth/login") {
    clearToken();
    mostrarLogin();
    throw new Error(data.erro || "Sessão expirada.");
  }
  if (!resp.ok) {
    throw new Error(data.erro || `Erro ${resp.status} ao chamar ${path}.`);
  }
  return data;
}
