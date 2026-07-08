// js/api.js
// A constante API_URL vem de config.js (carregado antes deste arquivo).

function getToken() { return localStorage.getItem("norta_token"); }
function setToken(t) { localStorage.setItem("norta_token", t); }
function clearToken() { localStorage.removeItem("norta_token"); }

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  const resp = await fetch(API_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const data = await resp.json().catch(() => ({}));

  if (resp.status === 401 && path !== "/auth/login") {
    clearToken();
    mostrarLogin();
    throw new Error(data.erro || "Sessão expirada.");
  }
  if (!resp.ok) {
    throw new Error(data.erro || "Erro na requisição.");
  }
  return data;
}
