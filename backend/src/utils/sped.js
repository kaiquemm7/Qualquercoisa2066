// src/utils/sped.js
// Helpers de formatação e montagem de registros no layout SPED (pipe-delimited).
// Gera a ESTRUTURA dos blocos a partir dos dados já cadastrados no sistema.
// IMPORTANTE: isto NÃO substitui a validação no PVA oficial nem a revisão de
// um contador — alíquotas/CST/NCM/CFOP usados são os cadastrados em cada
// produto (ou os padrões definidos), e o arquivo deve ser conferido antes
// de qualquer transmissão à Receita Federal / SEFAZ.

function linha(campos) {
  return "|" + campos.map(c => (c === null || c === undefined ? "" : String(c))).join("|") + "|";
}

function dataSped(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}${mm}${yyyy}`;
}

function valorSped(n) {
  return Number(n || 0).toFixed(2).replace(".", ",");
}

function soDigitos(s) {
  return (s || "").replace(/\D/g, "");
}

function montarBloco9(linhasAnteriores) {
  const contagem = {};
  linhasAnteriores.forEach(l => {
    const tipo = l.split("|")[1];
    contagem[tipo] = (contagem[tipo] || 0) + 1;
  });

  const linhas9 = [linha(["9001", "0"])];
  Object.keys(contagem).sort().forEach(tipo => {
    linhas9.push(linha(["9900", tipo, contagem[tipo]]));
  });
  linhas9.push(linha(["9900", "9001", 1]));
  linhas9.push(linha(["9900", "9990", 1]));
  linhas9.push(linha(["9900", "9999", 1]));
  const qtdBloco9 = linhas9.length + 1;
  linhas9.push(linha(["9990", qtdBloco9]));
  const totalGeral = linhasAnteriores.length + linhas9.length + 1;
  linhas9.push(linha(["9999", totalGeral]));
  return linhas9;
}

module.exports = { linha, dataSped, valorSped, soDigitos, montarBloco9 };
