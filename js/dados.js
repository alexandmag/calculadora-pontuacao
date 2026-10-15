// Dados fixos do INTERPUC Minas 11ª Edição (2026): atléticas, modalidades, provas e dias de jogos.
// Os nomes curtos das atléticas podem ser trocados no app (Ajustes); estes são só o ponto de partida.

// RG Art. 10. "logo" aponta para o escudo em img/atleticas (fundo transparente, ~480 px de largura).
export const ATLETICAS = [
  { id: 'ef', curto: 'Ed. Física', nome: 'Educação Física, Fisioterapia e Biomedicina' },
  { id: 'eng', curto: 'Engenharia', nome: 'Engenharia e Arquitetura', logo: 'img/atleticas/eng.webp' },
  { id: 'psi', curto: 'Psicologia', nome: 'Psicologia' },
  { id: 'med', curto: 'Medicina', nome: 'Medicina' },
  { id: 'vet', curto: 'Veterinária', nome: 'Medicina Veterinária' },
  { id: 'dir', curto: 'Direito', nome: 'Estudantes de Direito' },
  { id: 'com', curto: 'Comunicação', nome: 'José Albino de Comunicação' },
  { id: 'bio', curto: 'Biológicas', nome: 'Ciências Biológicas e Saúde' },
  { id: 'ics', curto: 'Sociais', nome: 'Instituto de Ciências Sociais' },
  { id: 'ger', curto: 'Gerenciais', nome: 'Gerenciais' },
  { id: 'odo', curto: 'Odontologia', nome: 'Odontologia' },
  { id: 'icei', curto: 'ICEI', nome: 'Instituto de Ciências Exatas e Informática' },
  { id: 'ich', curto: 'ICH', nome: 'Instituto de Ciências Humanas' },
];

export const LOGO = Object.fromEntries(ATLETICAS.filter((a) => a.logo).map((a) => [a.id, a.logo]));

export const LETRAS_GRUPO = ['A', 'B', 'C', 'D'];

// Coletivas: grupos → repescagem (em algumas) → semifinal → final. Não há oitavas, quartas nem
// disputa de 3º lugar: o 3º e o 4º saem de quem perdeu a semifinal para a campeã e para a vice.
export const FASES = [
  { id: 'grupo', nome: 'Fase de grupos' },
  { id: 'repescagem', nome: 'Repescagem' },
  { id: 'semifinal', nome: 'Semifinal' },
  { id: 'final', nome: 'Final' },
];

// Padrão das provas: vale 1x e cada atlética pode ter até 2 atletas (A1 Arts. 38 e 49).
const prova = (id, nome, extra = {}) => ({ id, nome, peso: 1, max: 2, ...extra });
const revezamento = (id, nome) => prova(id, nome, { peso: 2, max: 1 }); // A1 Arts. 43 e 54

const ATLETISMO = [
  prova('100', '100 m'),
  prova('200', '200 m'),
  prova('400', '400 m'),
  prova('800', '800 m'),
  prova('5000', '5.000 m'),
  revezamento('4x100', 'Revezamento 4×100 m'),
]; // A1 Art. 40

const NATACAO_M = [
  prova('50livre', '50 m livre'),
  prova('50costas', '50 m costas'),
  prova('50borboleta', '50 m borboleta'),
  prova('50peito', '50 m peito'),
  prova('100livre', '100 m livre'),
  revezamento('4x50livre', 'Revezamento 4×50 m livre'),
  revezamento('4x50medley', 'Revezamento 4×50 m medley'),
]; // A1 Art. 51

const NATACAO_F = NATACAO_M.filter((p) => p.id !== '100livre'); // o feminino não tem os 100 m livre

const CHAVE_TENIS = [prova('chave', 'Chave individual', { notas: 'Até 2 titulares por atlética' })]; // A1 Arts. 57 e 69

const LUTAS_M = [
  prova('leve', 'Leve / meio-médio (até 76 kg)', { max: 1 }),
  prova('medio', 'Médio (até 90 kg)', { max: 1 }),
  prova('pesado', 'Pesado (acima de 90 kg)', { max: 1 }),
]; // A1 Arts. 84 e 91

const LUTAS_F = [prova('absoluto', 'Absoluto', { max: 2 })];

const coletiva = (id, nome, curto, esporte, grupos, repescagem) => ({
  id,
  nome,
  curto,
  tipo: 'coletiva',
  esporte,
  repescagem,
  formato: grupos ? `${grupos} · ${repescagem ? 'repescagem, semifinal e final' : 'semifinal e final'}` : 'Formato a definir pela CO',
});
const comProvas = (id, nome, curto, provas, formato) => ({ id, nome, curto, tipo: 'provas', provas, formato });

// RG Art. 11. Os formatos das coletivas são os do tabelamento divulgado pela CO.
export const MODALIDADES = [
  coletiva('futsal-m', 'Futsal Masculino', 'Futsal M', 'futsal', '1 grupo de 5 e 2 grupos de 4 · 3 rodadas', true),
  coletiva('futsal-f', 'Futsal Feminino', 'Futsal F', 'futsal', '2 grupos de 5 · 4 rodadas', false),
  coletiva('futebol-m', 'Futebol de Campo', 'Futebol', 'futebol', '2 grupos de 4 e 1 grupo de 3 · 3 rodadas', true),
  coletiva('handebol-m', 'Handebol Masculino', 'Handebol M', 'handebol', '3 grupos de 3 · 3 rodadas', true),
  coletiva('handebol-f', 'Handebol Feminino', 'Handebol F', 'handebol', '2 grupos de 4 e 1 grupo de 3 · 3 rodadas', true),
  coletiva('basquete-m', 'Basquete Masculino', 'Basquete M', 'basquete', '2 grupos de 5 · 4 rodadas', false),
  coletiva('basquete-f', 'Basquete Feminino', 'Basquete F', 'basquete', '2 grupos de 4 · 4 rodadas', false),
  coletiva('volei-m', 'Vôlei Masculino', 'Vôlei M', 'volei', '3 grupos de 4 · 3 rodadas', true),
  coletiva('volei-f', 'Vôlei Feminino', 'Vôlei F', 'volei', '3 grupos de 4 · 3 rodadas', true),
  coletiva('peteca-m', 'Peteca Masculino', 'Peteca M', 'peteca', null, false),
  coletiva('peteca-f', 'Peteca Feminino', 'Peteca F', 'peteca', null, false),
  comProvas('atletismo-m', 'Atletismo Masculino', 'Atletismo M', ATLETISMO, '6 provas · revezamento vale em dobro'),
  comProvas('atletismo-f', 'Atletismo Feminino', 'Atletismo F', ATLETISMO, '6 provas · revezamento vale em dobro'),
  comProvas('natacao-m', 'Natação Masculino', 'Natação M', NATACAO_M, '7 provas · revezamentos valem em dobro'),
  comProvas('natacao-f', 'Natação Feminino', 'Natação F', NATACAO_F, '6 provas · revezamentos valem em dobro'),
  comProvas('tenis-mesa-m', 'Tênis de Mesa Masculino', 'T. Mesa M', CHAVE_TENIS, 'Chave eliminatória · soma dos 2 atletas'),
  comProvas('tenis-mesa-f', 'Tênis de Mesa Feminino', 'T. Mesa F', CHAVE_TENIS, 'Chave eliminatória · soma dos 2 atletas'),
  comProvas('tenis-m', 'Tênis de Campo Masculino', 'Tênis M', CHAVE_TENIS, 'Chave eliminatória · soma dos 2 atletas'),
  comProvas('tenis-f', 'Tênis de Campo Feminino', 'Tênis F', CHAVE_TENIS, 'Chave eliminatória · soma dos 2 atletas'),
  comProvas('judo-m', 'Judô Masculino', 'Judô M', LUTAS_M, '3 categorias de peso · soma das categorias'),
  comProvas('judo-f', 'Judô Feminino', 'Judô F', LUTAS_F, 'Absoluto · até 2 atletas por atlética'),
  comProvas('jiujitsu-m', 'Jiu-jitsu Masculino', 'Jiu-jitsu M', LUTAS_M, '3 categorias de peso · soma das categorias'),
  comProvas('jiujitsu-f', 'Jiu-jitsu Feminino', 'Jiu-jitsu F', LUTAS_F, 'Absoluto · até 2 atletas por atlética'),
  { id: 'xadrez', nome: 'Xadrez Misto', curto: 'Xadrez', tipo: 'classificacao', formato: 'Sistema suíço · lance a classificação final' },
];

export const MODALIDADE = Object.fromEntries(MODALIDADES.map((m) => [m.id, m]));

// Sábados e domingos entre 17/10 e 14/11 (RG Arts. 3º e 9º). São só atalhos: qualquer data pode ser usada.
export const DIAS_DE_JOGOS = [
  '2026-10-17',
  '2026-10-18',
  '2026-10-24',
  '2026-10-25',
  '2026-10-31',
  '2026-11-01',
  '2026-11-07',
  '2026-11-08',
  '2026-11-14',
];
