// src/routes/notasFiscais.routes.js
//
// Fluxo:
// 1) POST /importar-xml  -> recebe o XML da NF-e, extrai fornecedor e itens,
//    tenta casar cada item com um produto já cadastrado (por código interno
//    ou código de barras/EAN) e devolve uma PRÉVIA (nada é salvo ainda).
// 2) POST /              -> recebe a prévia (editada ou não pelo usuário) e
//    confirma: cria/atualiza fornecedor, cria produtos novos quando marcado,
//    dá entrada na quantidade de cada item e registra uma movimentação de
//    entrada por item, tudo vinculado ao número da nota.
//
// O lançamento manual (sem XML) usa a mesma rota de confirmação (POST /),
// só que a prévia é montada pelo próprio formulário no frontend.

const express = require("express");
const db = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { registrarLog } = require("../utils/audit");

const router = express.Router();
router.use(authenticate);

function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ---------- Parser de XML de NF-e (leve, sem dependências externas) ----------
function extrairTag(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function parseNFeXML(xml) {
  if (!xml || typeof xml !== "string" || !xml.includes("<")) {
    throw new Error("Arquivo XML inválido ou vazio.");
  }

  const numero = extrairTag(xml, "nNF");
  const serie = extrairTag(xml, "serie");
  const dataEmissao = extrairTag(xml, "dhEmi") || extrairTag(xml, "dEmi");
  const valorTotal = parseFloat(extrairTag(xml, "vNF") || "0");

  const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
  const chaveAcesso = chaveMatch ? chaveMatch[1] : null;

  const blocoEmit = (xml.match(/<emit>([\s\S]*?)<\/emit>/i) || [])[1] || "";
  const fornecedor = {
    cnpj: extrairTag(blocoEmit, "CNPJ"),
    nome: extrairTag(blocoEmit, "xNome"),
    telefone: extrairTag(blocoEmit, "fone")
  };

  const blocosItem = xml.match(/<det[^>]*>[\s\S]*?<\/det>/gi) || [];
  if (!blocosItem.length) {
    throw new Error("Nenhum item (tag <det>) encontrado no XML. Confirme se é um arquivo de NF-e válido.");
  }

  const itens = blocosItem.map(bloco => {
    const blocoProd = (bloco.match(/<prod>([\s\S]*?)<\/prod>/i) || [])[1] || bloco;
    const blocoImposto = (bloco.match(/<imposto>([\s\S]*?)<\/imposto>/i) || [])[1] || "";
    const blocoIcms = (blocoImposto.match(/<ICMS>([\s\S]*?)<\/ICMS>/i) || [])[1] || "";
    const blocoPis = (blocoImposto.match(/<PIS>([\s\S]*?)<\/PIS>/i) || [])[1] || "";
    const blocoCofins = (blocoImposto.match(/<COFINS>([\s\S]*?)<\/COFINS>/i) || [])[1] || "";

    return {
      codigoInterno: extrairTag(blocoProd, "cProd"),
      codigoBarras: extrairTag(blocoProd, "cEAN"),
      descricao: extrairTag(blocoProd, "xProd"),
      unidadeMedida: (extrairTag(blocoProd, "uCom") || "un").toLowerCase(),
      quantidade: parseFloat(extrairTag(blocoProd, "qCom") || "0"),
      valorUnitario: parseFloat(extrairTag(blocoProd, "vUnCom") || "0"),
      valorTotal: parseFloat(extrairTag(blocoProd, "vProd") || "0"),
      ncm: extrairTag(blocoProd, "NCM"),
      cfop: extrairTag(blocoProd, "CFOP"),
      cstIcms: extrairTag(blocoIcms, "CST") || extrairTag(blocoIcms, "CSOSN"),
      cstPis: extrairTag(blocoPis, "CST"),
      cstCofins: extrairTag(blocoCofins, "CST")
    };
  });

  return { numero, serie, dataEmissao, valorTotal, chaveAcesso, fornecedor, itens };
}

// ---------- Prévia: importar XML sem salvar nada ----------
router.post("/importar-xml", authorize("administrador", "supervisor", "almoxarife", "compras"), (req, res) => {
  const { xml } = req.body;
  if (!xml) return res.status(400).json({ erro: "Envie o conteúdo do XML no campo 'xml'." });

  let parsed;
  try {
    parsed = parseNFeXML(xml);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }

  const data = db.load();

  let fornecedorEncontrado = null;
  if (parsed.fornecedor.cnpj) {
    fornecedorEncontrado = data.fornecedores.find(f => (f.cnpj || "").replace(/\D/g, "") === parsed.fornecedor.cnpj.replace(/\D/g, ""));
  }
  if (!fornecedorEncontrado && parsed.fornecedor.nome) {
    fornecedorEncontrado = data.fornecedores.find(f => normalizar(f.nome) === normalizar(parsed.fornecedor.nome));
  }

  const itensComMatch = parsed.itens.map(item => {
    let produto = null;
    if (item.codigoInterno) {
      produto = data.produtos.find(p => p.codigoInterno === item.codigoInterno);
    }
    if (!produto && item.codigoBarras) {
      produto = data.produtos.find(p => p.codigoBarras === item.codigoBarras);
    }
    return {
      ...item,
      ncm: item.ncm || (produto ? produto.ncm : null),
      cfop: item.cfop || (produto ? produto.cfopPadrao : null),
      cstIcms: item.cstIcms || (produto ? produto.cstIcms : null),
      cstPis: item.cstPis || (produto ? produto.cstPis : null),
      cstCofins: item.cstCofins || (produto ? produto.cstCofins : null),
      produtoId: produto ? produto.id : null,
      produtoNomeAtual: produto ? produto.nome : null,
      quantidadeAtualEstoque: produto ? produto.quantidade : null
    };
  });

  res.json({
    numero: parsed.numero,
    serie: parsed.serie,
    dataEmissao: parsed.dataEmissao,
    valorTotal: parsed.valorTotal,
    chaveAcesso: parsed.chaveAcesso,
    fornecedor: parsed.fornecedor,
    fornecedorId: fornecedorEncontrado ? fornecedorEncontrado.id : null,
    itens: itensComMatch
  });
});

// ---------- Listar notas fiscais lançadas ----------
router.get("/", (req, res) => {
  const { busca } = req.query;
  const data = db.load();
  let lista = [...data.notasFiscais];

  if (busca) {
    const q = normalizar(busca);
    lista = lista.filter(n =>
      normalizar(n.numero).includes(q) ||
      normalizar(n.fornecedor).includes(q) ||
      normalizar(n.chaveAcesso || "").includes(q)
    );
  }

  lista.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  res.json(lista);
});

router.get("/:id", (req, res) => {
  const data = db.load();
  const nota = data.notasFiscais.find(n => n.id === parseInt(req.params.id, 10));
  if (!nota) return res.status(404).json({ erro: "Nota fiscal não encontrada." });
  res.json(nota);
});

// ---------- Confirmar/lançar nota (XML confirmado ou lançamento manual) ----------
router.post("/", authorize("administrador", "supervisor", "almoxarife", "compras"), (req, res) => {
  const { numero, serie, dataEmissao, valorTotal, chaveAcesso, fornecedorId, fornecedorNovo, itens, origem } = req.body;

  if (!numero) return res.status(400).json({ erro: "Número da nota é obrigatório." });
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: "A nota precisa ter ao menos um item." });
  }

  const data = db.load();

  const jaExiste = data.notasFiscais.some(n => n.numero === String(numero) && (!chaveAcesso || n.chaveAcesso === chaveAcesso));
  if (jaExiste) {
    return res.status(409).json({ erro: `A nota número ${numero} já foi lançada anteriormente.` });
  }

  let fornecedor = null;
  if (fornecedorId) {
    fornecedor = data.fornecedores.find(f => f.id === parseInt(fornecedorId, 10));
    if (!fornecedor) return res.status(400).json({ erro: "Fornecedor selecionado não encontrado." });
  } else if (fornecedorNovo && fornecedorNovo.nome) {
    data.contadores.fornecedor += 1;
    fornecedor = {
      id: data.contadores.fornecedor,
      nome: fornecedorNovo.nome,
      cnpj: fornecedorNovo.cnpj || null,
      contato: null,
      telefone: fornecedorNovo.telefone || null,
      email: null,
      endereco: null,
      categoria: null,
      observacoes: "Cadastrado automaticamente a partir de uma nota fiscal.",
      criadoEm: new Date().toISOString()
    };
    data.fornecedores.push(fornecedor);
  } else {
    return res.status(400).json({ erro: "Selecione um fornecedor ou informe os dados para cadastrar um novo." });
  }

  const itensProcessados = [];
  for (const item of itens) {
    if (!item.quantidade || item.quantidade <= 0) {
      return res.status(400).json({ erro: `Quantidade inválida para o item "${item.descricao || item.codigoInterno || "sem nome"}".` });
    }

    let produto = null;
    if (item.produtoId) {
      produto = data.produtos.find(p => p.id === parseInt(item.produtoId, 10));
      if (!produto) return res.status(400).json({ erro: `Produto vinculado ao item "${item.descricao}" não foi encontrado.` });
    } else if (item.criarProduto) {
      if (!item.codigoInterno || !(item.descricao || item.criarProduto.nome)) {
        return res.status(400).json({ erro: "Para cadastrar um produto novo é preciso informar nome e código interno." });
      }
      const codigoJaUsado = data.produtos.some(p => p.codigoInterno === item.codigoInterno);
      if (codigoJaUsado) {
        return res.status(409).json({ erro: `Já existe um produto com o código interno "${item.codigoInterno}".` });
      }
      data.contadores.produto += 1;
      produto = {
        id: data.contadores.produto,
        codigoInterno: item.codigoInterno,
        codigoBarras: item.codigoBarras || null,
        qrCode: null,
        nome: item.criarProduto.nome || item.descricao,
        categoria: item.criarProduto.categoria || "geral",
        fabricante: null,
        fornecedorId: fornecedor.id,
        fornecedor: fornecedor.nome,
        unidadeMedida: item.unidadeMedida || item.criarProduto.unidadeMedida || "un",
        localizacao: item.criarProduto.localizacao || null,
        lote: item.criarProduto.lote || null,
        numeroSerie: null,
        dataFabricacao: null,
        validade: item.criarProduto.validade || null,
        peso: null,
        dimensoes: null,
        setor: item.criarProduto.setor || "almoxarifado_central",
        quantidade: 0,
        estoqueMinimo: Number(item.criarProduto.estoqueMinimo || 0),
        estoqueMaximo: item.criarProduto.estoqueMaximo ? Number(item.criarProduto.estoqueMaximo) : null,
        valorUnitario: Number(item.valorUnitario || 0),
        foto: null,
        ncm: item.ncm || "00000000",
        cfopPadrao: item.cfop || "1102",
        cstIcms: item.cstIcms || "000",
        aliquotaIcms: Number(item.aliquotaIcms || 0),
        cstPis: item.cstPis || "01",
        aliquotaPis: Number(item.aliquotaPis || 1.65),
        cstCofins: item.cstCofins || "01",
        aliquotaCofins: Number(item.aliquotaCofins || 7.6),
        criadoEm: new Date().toISOString()
      };
      data.produtos.push(produto);
    } else {
      return res.status(400).json({ erro: `O item "${item.descricao || item.codigoInterno}" precisa estar vinculado a um produto existente ou marcado para cadastro.` });
    }

    produto.quantidade += Number(item.quantidade);
    if (item.valorUnitario) produto.valorUnitario = Number(item.valorUnitario);
    // Dados fiscais vindos da nota (XML ou digitados) são a fonte mais confiável — atualiza o produto
    if (item.ncm) produto.ncm = item.ncm;
    if (item.cfop) produto.cfopPadrao = item.cfop;
    if (item.cstIcms) produto.cstIcms = item.cstIcms;
    if (item.cstPis) produto.cstPis = item.cstPis;
    if (item.cstCofins) produto.cstCofins = item.cstCofins;

    data.contadores.movimentacao += 1;
    data.movimentacoes.push({
      id: data.contadores.movimentacao,
      produtoId: produto.id,
      produtoNome: produto.nome,
      tipo: "entrada",
      quantidade: Number(item.quantidade),
      setorDestino: null,
      retiradoPor: null,
      motivo: `Entrada por nota fiscal nº ${numero}`,
      observacoes: null,
      documento: `NF-${numero}`,
      usuarioId: req.usuario.id,
      usuarioNome: req.usuario.nome,
      dataHora: new Date().toISOString()
    });

    itensProcessados.push({
      produtoId: produto.id,
      produtoNome: produto.nome,
      codigoInterno: produto.codigoInterno,
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valorUnitario || 0),
      valorTotal: Number(item.valorTotal || item.quantidade * (item.valorUnitario || 0)),
      novoProduto: !item.produtoId,
      ncm: item.ncm || produto.ncm || "00000000",
      cfop: item.cfop || produto.cfopPadrao || "1102",
      cstIcms: item.cstIcms || produto.cstIcms || "000",
      cstPis: item.cstPis || produto.cstPis || "01",
      cstCofins: item.cstCofins || produto.cstCofins || "01"
    });
  }

  data.contadores.notaFiscal += 1;
  const nota = {
    id: data.contadores.notaFiscal,
    numero: String(numero),
    serie: serie || null,
    chaveAcesso: chaveAcesso || null,
    dataEmissao: dataEmissao || null,
    valorTotal: Number(valorTotal || itensProcessados.reduce((s, i) => s + i.valorTotal, 0)),
    fornecedorId: fornecedor.id,
    fornecedor: fornecedor.nome,
    origem: origem === "xml" ? "xml" : "manual",
    itens: itensProcessados,
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    criadoEm: new Date().toISOString()
  };
  data.notasFiscais.push(nota);
  db.save(data);

  registrarLog({
    usuarioId: req.usuario.id,
    usuarioNome: req.usuario.nome,
    acao: "LANCAR_NOTA_FISCAL",
    entidade: "notaFiscal",
    entidadeId: nota.id,
    detalhes: `NF ${nota.numero} — ${nota.fornecedor} — ${itensProcessados.length} ${itensProcessados.length === 1 ? "item" : "itens"}`
  });

  res.status(201).json(nota);
});

module.exports = router;
