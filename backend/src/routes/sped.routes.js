// src/routes/sped.routes.js
//
// Gera a estrutura de três arquivos fiscais a partir dos dados já
// cadastrados no sistema (produtos, fornecedores, notas fiscais e
// produção): SPED Fiscal (ICMS/IPI), SPED Contribuições (PIS/COFINS) e
// Bloco K isolado (Produção e Estoque). São arquivos de referência gerados
// automaticamente — o correto é revisar com o contador e validar no PVA
// oficial antes de transmitir.

const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { linha, dataSped, valorSped, soDigitos, montarBloco9 } = require("../utils/sped");

const router = express.Router();
router.use(authenticate);
router.use(authorize("administrador", "supervisor"));

function periodoValido(req, res) {
  const { dataInicio, dataFim } = req.body;
  if (!dataInicio || !dataFim) {
    res.status(400).json({ erro: "Informe o período (dataInicio e dataFim)." });
    return null;
  }
  return { inicio: new Date(dataInicio), fim: new Date(dataFim + "T23:59:59") };
}

function notasNoPeriodo(data, inicio, fim) {
  return data.notasFiscais.filter(n => {
    const d = new Date(n.criadoEm);
    return d >= inicio && d <= fim;
  });
}

// ---------- Bloco 0 (comum aos dois SPEDs) ----------
function blocoAbertura(empresa, inicio, fim, codVer, codFin) {
  const l = [];
  l.push(linha(["0000", codVer, codFin, dataSped(inicio), dataSped(fim), empresa.razaoSocial, soDigitos(empresa.cnpj), "", empresa.uf, soDigitos(empresa.ie), empresa.codMunicipio, "", "A", "0"]));
  l.push(linha(["0001", "0"]));
  l.push(linha(["0005", empresa.nomeFantasia, empresa.cep, empresa.endereco, empresa.numero, "", empresa.bairro, empresa.fone, "", empresa.email]));
  return l;
}

function blocoParticipantes(data) {
  const l = [];
  data.fornecedores.forEach(f => {
    l.push(linha(["0150", `F${f.id}`, f.nome, "01", soDigitos(f.cnpj), "", soDigitos(f.cnpj) ? "" : "", "", "", "", "", ""]));
  });
  return l;
}

function blocoItens(data) {
  const l = [];
  data.produtos.forEach(p => {
    l.push(linha(["0200", `P${p.id}`, p.nome, p.codigoBarras || "", "", p.unidadeMedida, (p.tipo === "equipamento_final" ? "07" : "00"), p.ncm || "00000000", "", "", ""]));
  });
  return l;
}

// ==================== SPED FISCAL (ICMS/IPI) ====================
router.post("/fiscal", (req, res) => {
  const periodo = periodoValido(req, res);
  if (!periodo) return;
  const { inicio, fim } = periodo;
  const data = db.load();
  const empresa = data.empresa;

  let corpo = [];
  corpo.push(...blocoAbertura(empresa, inicio, fim, "017", "0"));
  corpo.push(...blocoParticipantes(data));
  corpo.push(linha(["0190", "UN", "Unidade"]));
  corpo.push(...blocoItens(data));
  corpo.push(linha(["0990", corpo.length + 1]));

  // Bloco C — documentos fiscais (notas lançadas no período)
  const notas = notasNoPeriodo(data, inicio, fim);
  const blocoC = [linha(["C001", notas.length ? "0" : "1"])];
  notas.forEach(n => {
    const fornecedor = data.fornecedores.find(f => f.id === n.fornecedorId);
    blocoC.push(linha(["C100", "0", "1", fornecedor ? `F${fornecedor.id}` : "", "55", "00", "1", n.numero, n.chaveAcesso || "", dataSped(n.dataEmissao), dataSped(n.dataEmissao), valorSped(n.valorTotal), "0", "0,00", "0,00", valorSped(n.valorTotal), "0", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00"]));
    n.itens.forEach((item, i) => {
      const produto = data.produtos.find(p => p.id === item.produtoId);
      const cfop = (produto && produto.cfopPadrao) || "1102";
      const cst = (produto && produto.cstIcms) || "000";
      blocoC.push(linha(["C170", i + 1, `P${item.produtoId}`, "", item.quantidade, produto ? produto.unidadeMedida : "un", valorSped(item.valorTotal), "0,00", "0", cst, cfop, "", valorSped(item.valorTotal), valorSped((produto && produto.aliquotaIcms) || 0), "0,00", "0,00", "0,00", "0,00", "0", "", "0,00", "0,00", "0,00"]));
    });
  });
  blocoC.push(linha(["C990", blocoC.length + 1]));

  // Bloco K — produção e estoque (ver também endpoint isolado /bloco-k)
  const blocoK = montarBlocoK(data, inicio, fim);

  corpo = corpo.concat(blocoC, blocoK);
  const bloco9 = montarBloco9(corpo);
  const conteudo = corpo.concat(bloco9).join("\r\n");

  res.json({
    nomeArquivo: `SPED_FISCAL_${soDigitos(empresa.cnpj) || "EMPRESA"}_${dataSped(inicio)}_${dataSped(fim)}.txt`,
    conteudo
  });
});

// ==================== SPED CONTRIBUIÇÕES (PIS/COFINS) ====================
router.post("/contribuicoes", (req, res) => {
  const periodo = periodoValido(req, res);
  if (!periodo) return;
  const { inicio, fim } = periodo;
  const data = db.load();
  const empresa = data.empresa;

  const corpo = [];
  corpo.push(linha(["0000", "013", "0", dataSped(inicio), dataSped(fim), empresa.razaoSocial, soDigitos(empresa.cnpj), empresa.uf, soDigitos(empresa.ie), empresa.codMunicipio, "1", "1", "0"]));
  corpo.push(linha(["0001", "0"]));
  corpo.push(linha(["0110", "1", "1", "", ""])); // regime de apuração não cumulativo (ajustar conforme regime real)
  corpo.push(linha(["0140", "1", empresa.razaoSocial, soDigitos(empresa.cnpj), empresa.ie, empresa.codMunicipio, "", ""]));
  corpo.push(...blocoParticipantes(data));
  corpo.push(...blocoItens(data));
  corpo.push(linha(["0990", corpo.length + 1]));

  corpo.push(linha(["A001", "1"])); // bloco A (serviços) sem dados

  const notas = notasNoPeriodo(data, inicio, fim);
  const blocoC = [linha(["C001", notas.length ? "0" : "1"])];
  let totalBcPis = 0, totalPis = 0, totalBcCofins = 0, totalCofins = 0;
  notas.forEach(n => {
    const fornecedor = data.fornecedores.find(f => f.id === n.fornecedorId);
    blocoC.push(linha(["C010", soDigitos(empresa.cnpj)]));
    blocoC.push(linha(["C100", "0", "1", fornecedor ? `F${fornecedor.id}` : "", "55", "00", n.numero, n.chaveAcesso || "", dataSped(n.dataEmissao), valorSped(n.valorTotal)]));
    n.itens.forEach((item, i) => {
      const produto = data.produtos.find(p => p.id === item.produtoId);
      const cstPis = (produto && produto.cstPis) || "01";
      const aliqPis = (produto && produto.aliquotaPis) || 1.65;
      const cstCofins = (produto && produto.cstCofins) || "01";
      const aliqCofins = (produto && produto.aliquotaCofins) || 7.6;
      const vlPis = (item.valorTotal * aliqPis) / 100;
      const vlCofins = (item.valorTotal * aliqCofins) / 100;
      totalBcPis += item.valorTotal; totalPis += vlPis;
      totalBcCofins += item.valorTotal; totalCofins += vlCofins;
      blocoC.push(linha(["C170", i + 1, `P${item.produtoId}`, "", item.quantidade, produto ? produto.unidadeMedida : "un", valorSped(item.valorTotal), cstPis, valorSped(item.valorTotal), valorSped(aliqPis), valorSped(vlPis), cstCofins, valorSped(item.valorTotal), valorSped(aliqCofins), valorSped(vlCofins)]));
    });
  });
  blocoC.push(linha(["C990", blocoC.length + 1]));

  const blocoM = [];
  blocoM.push(linha(["M001", "0"]));
  blocoM.push(linha(["M200", valorSped(totalPis), "0,00", "0,00", "0,00", "0,00", "0,00", valorSped(totalPis)]));
  blocoM.push(linha(["M210", "51", valorSped(totalBcPis), "0,00", "0,00", "1,65", valorSped(totalPis), "0,00", "0,00"]));
  blocoM.push(linha(["M600", valorSped(totalCofins), "0,00", "0,00", "0,00", "0,00", "0,00", valorSped(totalCofins)]));
  blocoM.push(linha(["M610", "51", valorSped(totalBcCofins), "0,00", "0,00", "7,60", valorSped(totalCofins), "0,00", "0,00"]));
  blocoM.push(linha(["M990", blocoM.length + 1]));

  const todasLinhas = corpo.concat(blocoC, blocoM);
  const bloco9 = montarBloco9(todasLinhas);
  const conteudo = todasLinhas.concat(bloco9).join("\r\n");

  res.json({
    nomeArquivo: `SPED_CONTRIBUICOES_${soDigitos(empresa.cnpj) || "EMPRESA"}_${dataSped(inicio)}_${dataSped(fim)}.txt`,
    conteudo,
    resumo: { totalBcPis, totalPis, totalBcCofins, totalCofins }
  });
});

// ==================== BLOCO K ISOLADO (Produção e Estoque) ====================
function montarBlocoK(data, inicio, fim) {
  const l = [];
  const temDados = data.producoes.some(o => {
    const d = new Date(o.criadoEm);
    return d >= inicio && d <= fim;
  });
  l.push(linha(["K001", temDados ? "0" : "1"]));
  l.push(linha(["K100", dataSped(inicio), dataSped(fim)]));

  // K200 — estoque escriturado na data final do período, por item
  data.produtos.forEach(p => {
    l.push(linha(["K200", dataSped(fim), `P${p.id}`, p.quantidade.toFixed(4).replace(".", ","), "", "0"]));
  });

  // K230/K235 — ordens de produção do período e insumos consumidos
  data.producoes
    .filter(o => { const d = new Date(o.criadoEm); return d >= inicio && d <= fim; })
    .forEach(o => {
      l.push(linha(["K230", dataSped(o.criadoEm), dataSped(o.criadoEm), `OP${o.id}`, `P${o.produtoFinalId}`, o.quantidadeProduzida.toFixed(4).replace(".", ",")]));
      o.componentesConsumidos.forEach(c => {
        l.push(linha(["K235", `P${c.produtoId}`, c.quantidadeConsumida.toFixed(4).replace(".", ","), `OP${o.id}`]));
      });
    });

  l.push(linha(["K990", l.length + 1]));
  return l;
}

router.post("/bloco-k", (req, res) => {
  const periodo = periodoValido(req, res);
  if (!periodo) return;
  const { inicio, fim } = periodo;
  const data = db.load();
  const empresa = data.empresa;

  const corpo = [];
  corpo.push(...blocoAbertura(empresa, inicio, fim, "017", "0"));
  corpo.push(...blocoItens(data));
  corpo.push(linha(["0990", corpo.length + 1]));
  corpo.push(...montarBlocoK(data, inicio, fim));

  const bloco9 = montarBloco9(corpo);
  const conteudo = corpo.concat(bloco9).join("\r\n");

  res.json({
    nomeArquivo: `BLOCO_K_${soDigitos(empresa.cnpj) || "EMPRESA"}_${dataSped(inicio)}_${dataSped(fim)}.txt`,
    conteudo
  });
});

module.exports = router;
