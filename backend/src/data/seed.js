// src/data/seed.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const rounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
const hash = (senha) => bcrypt.hashSync(senha, rounds);

const usuarios = [
  { id: 1, nome: "Ana Ribeiro", usuario: "admin", senhaHash: hash("Admin@123"), papel: "administrador", setor: "ti", cargo: "Administradora do sistema", twoFactorAtivo: false, tentativasFalhas: 0, bloqueadoAte: null, criadoEm: new Date().toISOString() },
  { id: 2, nome: "Carlos Mendes", usuario: "carlos.mendes", senhaHash: hash("Almox@123"), papel: "almoxarife", setor: "almoxarifado_central", cargo: "Almoxarife", twoFactorAtivo: false, tentativasFalhas: 0, bloqueadoAte: null, criadoEm: new Date().toISOString() },
  { id: 3, nome: "Julia Alves", usuario: "julia.alves", senhaHash: hash("Superv@123"), papel: "supervisor", setor: "almoxarifado_central", cargo: "Supervisora de almoxarifado", twoFactorAtivo: false, tentativasFalhas: 0, bloqueadoAte: null, criadoEm: new Date().toISOString() },
  { id: 4, nome: "Paulo Souza", usuario: "paulo.souza", senhaHash: hash("Compras@123"), papel: "compras", setor: "compras", cargo: "Analista de compras", twoFactorAtivo: false, tentativasFalhas: 0, bloqueadoAte: null, criadoEm: new Date().toISOString() },
  { id: 5, nome: "Marina Torres", usuario: "marina.torres", senhaHash: hash("Producao@123"), papel: "producao", setor: "producao", cargo: "Operadora de produção", twoFactorAtivo: false, tentativasFalhas: 0, bloqueadoAte: null, criadoEm: new Date().toISOString() },
  { id: 6, nome: "Roberto Lima", usuario: "roberto.lima", senhaHash: hash("Auditor@123"), papel: "auditor", setor: "auditoria", cargo: "Auditor interno", twoFactorAtivo: false, tentativasFalhas: 0, bloqueadoAte: null, criadoEm: new Date().toISOString() }
];

const fornecedores = [
  { id: 1, nome: "Rolamentos Brasil Ltda", cnpj: "12.345.678/0001-90", telefone: "(11) 98765-4321", email: "contato@rolamentosbrasil.com.br", endereco: "Av. Paulista, 1000 - São Paulo/SP" },
  { id: 2, nome: "Elétrica Industrial SA", cnpj: "98.765.432/0001-87", telefone: "(21) 98765-4321", email: "contato@eletricaindustrial.com.br", endereco: "Rua das Flores, 123 - Rio de Janeiro/RJ" },
  { id: 3, nome: "Segurança Total EPIs", cnpj: "56.789.012/0001-34", telefone: "(31) 98765-4321", email: "contato@segurancatotal.com.br", endereco: "Av. Getúlio Vargas, 456 - Belo Horizonte/MG" },
  { id: 4, nome: "Hidráulica Sul", cnpj: "34.567.890/0001-12", telefone: "(51) 98765-4321", email: "contato@hidraulicasul.com.br", endereco: "Rua do Comércio, 789 - Porto Alegre/RS" },
  { id: 5, nome: "Distribuidora Óleo Certo", cnpj: "78.901.234/0001-56", telefone: "(41) 98765-4321", email: "contato@oleocerto.com.br", endereco: "Av. das Nações Unidas, 100 - Curitiba/PR" },
  { id: 6, nome: "Ferramentaria Central", cnpj: "12.345.678/0001-90", telefone: "(61) 98765-4321", email: "contato@ferramentariacentral.com.br", endereco: "Rua das Flores, 123 - Brasília/DF" }
];

const hoje = new Date();
const emDias = (n) => new Date(hoje.getTime() + n * 86400000).toISOString().slice(0, 10);

const produtos = [
  { id: 1, codigoInterno: "MP-0231", codigoBarras: "7891000123456", nome: "Rolamento 6205-2RS", categoria: "Mecânica", fabricante: "SKF", fornecedor: "Rolamentos Brasil Ltda", unidadeMedida: "un", localizacao: "R03-CA-P12", lote: "L2406-A", numeroSerie: null, dataFabricacao: emDias(-120), validade: null, peso: "0.08kg", dimensoes: "25x52x15mm", setor: "almoxarifado_central", quantidade: 8, estoqueMinimo: 20, estoqueMaximo: 200, valorUnitario: 18.9, foto: null, criadoEm: new Date().toISOString() },
  { id: 2, codigoInterno: "EL-1042", codigoBarras: "7891000123457", nome: "Disjuntor tripolar 63A", categoria: "Elétrica", fabricante: "WEG", fornecedor: "Elétrica Industrial SA", unidadeMedida: "un", localizacao: "R01-CB-P04", lote: "L2403-C", numeroSerie: null, dataFabricacao: emDias(-200), validade: null, peso: "0.4kg", dimensoes: "90x70x65mm", setor: "almoxarifado_central", quantidade: 15, estoqueMinimo: 30, estoqueMaximo: 150, valorUnitario: 89.5, foto: null, criadoEm: new Date().toISOString() },
  { id: 3, codigoInterno: "EPI-0087", codigoBarras: "7891000123458", nome: "Luva de raspa cano longo", categoria: "EPI", fabricante: "Danny", fornecedor: "Segurança Total EPIs", unidadeMedida: "par", localizacao: "R05-CA-P02", lote: "L2405-B", numeroSerie: null, dataFabricacao: emDias(-60), validade: emDias(540), peso: "0.2kg", dimensoes: null, setor: "almoxarifado_central", quantidade: 340, estoqueMinimo: 100, estoqueMaximo: 500, valorUnitario: 12.3, foto: null, criadoEm: new Date().toISOString() },
  { id: 4, codigoInterno: "HD-0512", codigoBarras: "7891000123459", nome: "Mangueira hidráulica 3/4\"", categoria: "Hidráulica", fabricante: "Parker", fornecedor: "Hidráulica Sul", unidadeMedida: "m", localizacao: "R02-CD-P09", lote: "L2401-A", numeroSerie: null, dataFabricacao: emDias(-300), validade: null, peso: "1.1kg/m", dimensoes: null, setor: "producao", quantidade: 12, estoqueMinimo: 15, estoqueMaximo: 100, valorUnitario: 34.7, foto: null, criadoEm: new Date().toISOString() },
  { id: 5, codigoInterno: "MP-0459", codigoBarras: "7891000123460", nome: "Correia dentada B-112", categoria: "Mecânica", fabricante: "Gates", fornecedor: "Rolamentos Brasil Ltda", unidadeMedida: "un", localizacao: "R03-CB-P07", lote: "L2312-D", numeroSerie: null, dataFabricacao: emDias(-400), validade: null, peso: "0.3kg", dimensoes: null, setor: "producao", quantidade: 0, estoqueMinimo: 10, estoqueMaximo: 60, valorUnitario: 45.0, foto: null, criadoEm: new Date().toISOString() },
  { id: 6, codigoInterno: "QM-0021", codigoBarras: "7891000123461", nome: "Óleo lubrificante ISO 68", categoria: "Química", fabricante: "Lubrax", fornecedor: "Distribuidora Óleo Certo", unidadeMedida: "l", localizacao: "R06-CA-P01", lote: "L2402-A", numeroSerie: null, dataFabricacao: emDias(-90), validade: emDias(400), peso: null, dimensoes: null, setor: "manutencao", quantidade: 44, estoqueMinimo: 20, estoqueMaximo: 200, valorUnitario: 22.4, foto: null, criadoEm: new Date().toISOString() },
  { id: 7, codigoInterno: "EPI-0143", codigoBarras: "7891000123462", nome: "Óculos de proteção incolor", categoria: "EPI", fabricante: "3M", fornecedor: "Segurança Total EPIs", unidadeMedida: "un", localizacao: "R05-CB-P05", lote: "L2311-C", numeroSerie: null, dataFabricacao: emDias(-500), validade: emDias(-120), peso: null, dimensoes: null, setor: "almoxarifado_central", quantidade: 6, estoqueMinimo: 50, estoqueMaximo: 300, valorUnitario: 8.9, foto: null, criadoEm: new Date().toISOString() },
  { id: 8, codigoInterno: "FR-0302", codigoBarras: "7891000123463", nome: "Broca aço rápido 8mm", categoria: "Ferramentas", fabricante: "Bosch", fornecedor: "Ferramentaria Central", unidadeMedida: "un", localizacao: "R04-CA-P10", lote: "L2404-B", numeroSerie: null, dataFabricacao: emDias(-150), validade: null, peso: "0.03kg", dimensoes: null, setor: "ferramentaria", quantidade: 210, estoqueMinimo: 60, estoqueMaximo: 150, valorUnitario: 6.2, foto: null, criadoEm: new Date().toISOString() }
];

const movimentacoes = [
  { id: 1, produtoId: 2, produtoNome: "Disjuntor tripolar 63A", tipo: "saida", quantidade: 5, setorDestino: "manutencao", motivo: "Manutenção linha 2", observacoes: null, documento: "OS-4021", usuarioId: 3, usuarioNome: "Julia Alves", dataHora: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: 2, produtoId: 6, produtoNome: "Óleo lubrificante ISO 68", tipo: "entrada", quantidade: 40, setorDestino: null, motivo: "Recebimento fornecedor", observacoes: null, documento: "NF-88213", usuarioId: 2, usuarioNome: "Carlos Mendes", dataHora: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 3, produtoId: 3, produtoNome: "Luva de raspa cano longo", tipo: "saida", quantidade: 20, setorDestino: "producao", motivo: "Requisição produção", observacoes: null, documento: "REQ-1187", usuarioId: 5, usuarioNome: "Marina Torres", dataHora: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: 4, produtoId: 1, produtoNome: "Rolamento 6205-2RS", tipo: "ajuste", quantidade: 8, setorDestino: null, motivo: "Divergência inventário", observacoes: "Contagem cíclica mensal", documento: "INV-0044", usuarioId: 2, usuarioNome: "Carlos Mendes", dataHora: new Date(Date.now() - 26 * 3600000).toISOString() },
  { id: 5, produtoId: 8, produtoNome: "Broca aço rápido 8mm", tipo: "transferencia", quantidade: 30, setorDestino: "producao", motivo: "Ferramentaria → Produção", observacoes: null, documento: "TR-0091", usuarioId: 3, usuarioNome: "Julia Alves", dataHora: new Date(Date.now() - 30 * 3600000).toISOString() }
];

const dbData = {
  fornecedores,
  usuarios,
  produtos,
  movimentacoes,
  logs: [],
  contadores: { produto: produtos.length, movimentacao: movimentacoes.length, usuario: usuarios.length, log: 0 }
};

db.save(dbData);
console.log("Banco de dados inicial criado com sucesso em src/data/db.json");
console.log("");
console.log("Usuários de teste (usuario / senha):");
console.log("  admin           / Admin@123        (administrador)");
console.log("  carlos.mendes   / Almox@123         (almoxarife)");
console.log("  julia.alves     / Superv@123        (supervisor)");
console.log("  paulo.souza     / Compras@123       (compras)");
console.log("  marina.torres   / Producao@123      (producao)");
console.log("  roberto.lima    / Auditor@123       (auditor)");
