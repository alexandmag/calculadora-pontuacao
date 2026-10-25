import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarModelo } from '../js/modelo.js';
import { preverCompeticao } from '../js/previsao.js';
import { ESPORTES } from '../js/regras.js';
import { analisarGrupo, previsaoObjetiva, situacaoModalidade, veredito } from '../js/situacao.js';

let seq = 0;
const jogo = (a, b, res = null, extra = {}) => ({ id: `j${++seq}`, fase: 'grupo', a, b, res, ...extra });

// Caso de cada combinação dos jogos do time: { classe, condições em texto curto }.
const resumo = (t) => Object.fromEntries(t.resumo.map((c) => [c.classe, c.opcoes.map((o) => o.map((x) => `${x.resultados.join('/')}:${x.contra}`).join(' '))]));

test('handebol, grupo de 3 com repescagem: vencer garante a semifinal, empatar garante a repescagem', () => {
  // Engenharia venceu a Psicologia; faltam Engenharia × Odonto e Odonto × Psicologia.
  const jogos = [jogo('eng', 'psi', { a: 27, b: 6 }), jogo('eng', 'odo'), jogo('odo', 'psi')];
  const g = analisarGrupo({ membros: ['eng', 'psi', 'odo'], jogos, esporte: ESPORTES.handebol, diretas: 1, repescagem: true });
  assert.equal(g.faltam.length, 2);
  const eng = g.times.eng;
  assert.deepEqual(eng.possiveis, ['semi', 'repescagem', 'fora']);
  assert.equal(eng.destino, null);
  assert.deepEqual(resumo(eng), { semi: ['v:odo'], repescagem: ['e:odo'], depende: ['d:odo'] });
  // Empatando, vai direto se a Odonto não vencer a Psicologia (senão, saldo).
  const rep = eng.resumo.find((c) => c.classe === 'repescagem');
  assert.equal(rep.exato, false);
  assert.equal(rep.saldo, true);
  assert.deepEqual(rep.depende.map((d) => [d.jogo.a, d.jogo.b, d.torcer.join('')]), [['odo', 'psi', 'eb']]);
});

test('quem já não alcança a vaga está fora, e quem não pode cair está garantida', () => {
  // Basquete, 2 grupos de 4 sem repescagem (os dois primeiros vão à semifinal).
  const jogos = [
    jogo('eng', 'med', { a: 50, b: 20 }),
    jogo('eng', 'dir', { a: 50, b: 20 }),
    jogo('dir', 'ef', { a: 50, b: 20 }),
    jogo('med', 'ef', { a: 50, b: 20 }),
    jogo('eng', 'ef'),
    jogo('med', 'dir'),
  ];
  const g = analisarGrupo({ membros: ['eng', 'med', 'dir', 'ef'], jogos, esporte: ESPORTES.basquete, diretas: 2 });
  // Engenharia tem 2 vitórias e só quem vencer Med × Dir pode chegar a 2: está entre as duas primeiras.
  assert.equal(g.times.eng.destino, 'semi');
  // Ed. Física perdeu os dois e chega no máximo a 1 vitória: atrás da Engenharia e de quem vencer Med × Dir.
  assert.equal(g.times.ef.destino, 'fora');
  assert.equal(g.completo, false);
  // Com mais jogos pela frente, ela ainda pode chegar.
  const cedo = analisarGrupo({
    membros: ['eng', 'med', 'dir', 'ef'],
    jogos: [jogo('eng', 'med', { a: 50, b: 20 }), jogo('dir', 'ef', { a: 50, b: 20 }), jogo('eng', 'dir'), jogo('eng', 'ef'), jogo('med', 'dir'), jogo('med', 'ef')],
    esporte: ESPORTES.basquete,
    diretas: 2,
  });
  assert.deepEqual(cedo.times.ef.possiveis, ['semi', 'fora']);
  assert.equal(cedo.times.ef.destino, null);
});

test('empate entre quem já jogou tudo sai pelo desempate do regulamento, sem "depende do saldo"', () => {
  // Futsal, grupo de 3 encerrado: cada um venceu uma vez (3 pontos), o saldo decide.
  const jogos = [jogo('eng', 'psi', { a: 5, b: 0 }), jogo('psi', 'odo', { a: 2, b: 1 }), jogo('odo', 'eng', { a: 1, b: 0 })];
  const g = analisarGrupo({ membros: ['eng', 'psi', 'odo'], jogos, esporte: ESPORTES.futsal, diretas: 1, repescagem: true });
  assert.equal(g.completo, true);
  assert.equal(g.times.eng.destino, 'semi'); // saldo +4
  assert.equal(g.times.odo.destino, 'repescagem'); // saldo 0
  assert.equal(g.times.psi.destino, 'fora'); // saldo −4
});

test('vôlei: o placar em sets muda a conta (perder um set vale ponto)', () => {
  // Engenharia venceu a Psicologia por 2×0 (3 pontos); faltam Engenharia × Vinkão e Vinkão × Psicologia.
  const jogos = [jogo('eng', 'psi', { a: 2, b: 0 }), jogo('eng', 'ger'), jogo('ger', 'psi')];
  const g = analisarGrupo({ membros: ['eng', 'psi', 'ger'], jogos, esporte: ESPORTES.volei, diretas: 1, repescagem: true });
  const eng = g.times.eng;
  const r = resumo(eng);
  assert.deepEqual(r.semi, ['v20/v21:ger']);
  // Perdendo por 1×2 (1 ponto) ela ainda soma 4 e não cai do 2º lugar; por 0×2 pode cair.
  assert.ok(r.repescagem.includes('d12:ger'), JSON.stringify(r));
  assert.ok(r.depende.includes('d02:ger'), JSON.stringify(r));
});

// Futebol: 3 grupos com repescagem, um jogo feito em cada.
function futebol() {
  const estado = { config: { geral: { nossa: 'eng' } }, modalidades: {}, jogos: {}, resultados: {}, penalidades: {} };
  estado.modalidades['futebol-m'] = { grupoDe: { eng: 'A', med: 'A', icei: 'A', dir: 'B', odo: 'B', ich: 'B', ef: 'C', ger: 'C', psi: 'C' } };
  const grupos = { A: ['eng', 'med', 'icei'], B: ['dir', 'odo', 'ich'], C: ['ef', 'ger', 'psi'] };
  for (const [letra, ids] of Object.entries(grupos)) {
    ids.forEach((x, i) =>
      ids.slice(i + 1).forEach((y) => {
        estado.jogos[`${x}-${y}`] = { mod: 'futebol-m', fase: 'grupo', grupo: letra, a: x, b: y, data: '', hora: '', local: '', res: null };
      }),
    );
  }
  estado.jogos['eng-med'].res = { a: 5, b: 0 };
  estado.jogos['dir-odo'].res = { a: 7, b: 1 };
  estado.jogos['ef-ger'].res = { a: 2, b: 0 };
  return estado;
}

test('previsão objetiva: veredito, chance de cada caso e adversários da repescagem', () => {
  const modelo = montarModelo(futebol());
  const prev = preverCompeticao(modelo, { simulacoes: 400 });
  const [o] = previsaoObjetiva(modelo, prev, 'eng');
  assert.equal(o.mod, 'futebol-m');
  assert.ok(['semi', 'repescagem'].includes(o.categoria));
  // As combinações dos casos cobrem todas as simulações (a chave é a mesma nas duas contas).
  const n = o.t.resumo.flatMap((c) => c.chaves).reduce((s, k) => s + (o.chances.padroes[k]?.n || 0), 0);
  assert.equal(n, 400);
  // Quem cai num caso de "semifinal garantida" vai à semifinal em todas essas simulações.
  const semi = o.t.resumo.find((c) => c.classe === 'semi');
  const dentro = semi.chaves.reduce((s, k) => s + (o.chances.padroes[k]?.semi || 0), 0);
  const total = semi.chaves.reduce((s, k) => s + (o.chances.padroes[k]?.n || 0), 0);
  assert.equal(dentro, total);
  // Chance de cada resultado no jogo que falta contra a Pinguins soma 1.
  assert.equal(Math.round(Object.values(o.chances.jogos.icei).reduce((s, x) => s + x, 0) * 1000), 1000);
  // Na repescagem só cabem os 2º colocados dos outros grupos.
  for (const r of Object.keys(o.chances.rivalRepescagem)) assert.ok(['dir', 'odo', 'ich', 'ef', 'ger', 'psi'].includes(r), r);
});

test('veredito: garantida, provável, repescagem, briga e fora', () => {
  const sit = { repescagem: true, mataMata: false };
  assert.deepEqual(veredito(sit, { destino: 'semi', possiveis: ['semi'] }, null), { categoria: 'semi', motivo: 'garantida' });
  assert.deepEqual(veredito(sit, { destino: 'fora', possiveis: ['fora'] }, null), { categoria: 'fora', motivo: 'eliminada' });
  const viva = { destino: null, possiveis: ['semi', 'repescagem', 'fora'] };
  assert.equal(veredito(sit, viva, { lider: 0.7, repescagem: 0.2, semi: 0.8 }).motivo, 'provavel');
  assert.equal(veredito(sit, viva, { lider: 0.3, repescagem: 0.5, semi: 0.5 }).categoria, 'repescagem');
  assert.equal(veredito(sit, viva, { lider: 0, repescagem: 0.01, semi: 0.01 }).motivo, 'praticamente');
  assert.equal(veredito({ repescagem: false, mataMata: false }, { destino: null, possiveis: ['semi', 'fora'] }, { lider: 0.1, semi: 0.4 }).categoria, 'briga');
});

test('W.O. tira a atlética da conta do grupo', () => {
  const estado = futebol();
  estado.jogos['eng-icei'].res = { wo: 'b' }; // Pinguins não compareceu
  const modelo = montarModelo(estado);
  const sit = situacaoModalidade(modelo.modalidades['futebol-m']);
  assert.equal(sit.times.icei.wo, true);
  assert.equal(sit.times.icei.destino, 'fora');
  // Sobram Engenharia e Medicina no grupo A, e a Engenharia já venceu a Medicina.
  assert.equal(sit.times.eng.destino, 'semi');
});
