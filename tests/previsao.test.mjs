import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarModelo } from '../js/modelo.js';
import { cenarios, estimarForcas, PARAMETROS, preverCompeticao } from '../js/previsao.js';
import { ESPORTES } from '../js/regras.js';

const vazio = () => ({ config: { geral: { nossa: 'eng' } }, modalidades: {}, jogos: {}, resultados: {}, penalidades: {} });
let seq = 0;
const jogo = (mod, a, b, res = null, extra = {}) => [`j${++seq}`, { mod, fase: 'grupo', grupo: 'A', a, b, data: '', hora: '', local: '', res, ...extra }];

// Basquete feminino: 2 grupos de 4, sem repescagem (semi: 1º de um grupo x 2º do outro).
function basquete() {
  const estado = vazio();
  estado.modalidades['basquete-f'] = { grupoDe: { eng: 'A', med: 'A', dir: 'A', ef: 'A', odo: 'B', ger: 'B', com: 'B', psi: 'B' } };
  const grupo = (letra, ids) => ids.flatMap((x, i) => ids.slice(i + 1).map((y) => jogo('basquete-f', x, y, null, { grupo: letra })));
  estado.jogos = Object.fromEntries([...grupo('A', ['eng', 'med', 'dir', 'ef']), ...grupo('B', ['odo', 'ger', 'com', 'psi'])]);
  return estado;
}

test('força: quem vence por muito fica acima de quem perde, e sem jogos fica na média', () => {
  const [, j] = jogo('basquete-f', 'eng', 'med', { a: 40, b: 10 });
  const f = estimarForcas(['eng', 'med', 'dir'], [j], ESPORTES.basquete, PARAMETROS.basquete);
  assert.ok(f.media[0] > 0 && f.media[1] < 0);
  assert.equal(Math.round(f.media[2] * 1000), 0);
});

test('previsão: soma de chances fecha e a mesma semente dá o mesmo resultado', () => {
  const modelo = montarModelo(basquete());
  const a = preverCompeticao(modelo, { simulacoes: 300 });
  const b = preverCompeticao(modelo, { simulacoes: 300 });
  assert.deepEqual(a.geral, b.geral);
  const times = Object.values(a.modalidades['basquete-f']);
  const soma = (k) => times.reduce((s, c) => s + c[k], 0);
  assert.equal(Math.round(soma('titulo') * 1000), 1000, 'uma campeã por simulação');
  assert.equal(Math.round(soma('final') * 1000), 2000, 'duas finalistas');
  assert.equal(Math.round(soma('semi') * 1000), 4000, 'quatro semifinalistas');
  assert.equal(Math.round(soma('lider') * 1000), 2000, 'um líder por grupo');
  // Pontos esperados somam 12+9+7+5+4+3+2+1 = 43 por simulação.
  assert.equal(Math.round(soma('pontos')), 43);
});

test('previsão: resultados do grupo pesam e jogo já feito não é sorteado de novo', () => {
  const estado = basquete();
  for (const [id, j] of Object.entries(estado.jogos)) {
    if (j.a === 'eng' || j.b === 'eng') estado.jogos[id] = { ...j, res: j.a === 'eng' ? { a: 60, b: 20 } : { a: 20, b: 60 } };
  }
  const prev = preverCompeticao(montarModelo(estado), { simulacoes: 400 });
  const eng = prev.modalidades['basquete-f'].eng;
  assert.equal(eng.lider, 1, 'venceu os três jogos do grupo: é líder em todas as simulações');
  assert.equal(eng.semi, 1);
  assert.ok(eng.titulo > 0.3, `título ${eng.titulo}`);
  assert.ok(eng.rivalSemi.com + eng.rivalSemi.odo + eng.rivalSemi.ger + eng.rivalSemi.psi > 0.99, 'a semi é contra o 2º do outro grupo');
});

test('previsão: modalidade encerrada não é simulada e seus pontos já contam', () => {
  const estado = basquete();
  for (const [id, j] of Object.entries(estado.jogos)) estado.jogos[id] = { ...j, res: { a: 30, b: 20 } };
  Object.assign(estado.jogos, Object.fromEntries([
    jogo('basquete-f', 'eng', 'ger', { a: 30, b: 20 }, { fase: 'semifinal', grupo: null }),
    jogo('basquete-f', 'odo', 'med', { a: 30, b: 20 }, { fase: 'semifinal', grupo: null }),
    jogo('basquete-f', 'eng', 'odo', { a: 30, b: 20 }, { fase: 'final', grupo: null }),
  ]));
  const prev = preverCompeticao(montarModelo(estado), { simulacoes: 50 });
  assert.ok(!prev.simuladas.includes('basquete-f'));
  assert.equal(prev.geral.find((l) => l.id === 'eng').atuais, 12);
});

test('modalidade sem resultado: quem foi bem em 2025 tende a ir bem de novo, mas sem certeza', () => {
  const prev = preverCompeticao(montarModelo(vazio()), { simulacoes: 600 });
  const natacao = prev.modalidades['natacao-m'];
  // Em 2025 a Engenharia foi campeã da natação masculina e a Ajac não pontuou.
  assert.ok(natacao.eng.titulo > 0.3, `título ${natacao.eng.titulo}`);
  assert.ok(natacao.eng.titulo < 0.9, 'não é certeza');
  assert.ok(natacao.eng.pontos > natacao.com.pontos);
  assert.equal(natacao.eng.tipo, 'historico');
  assert.equal(Math.round(Object.values(natacao).reduce((s, c) => s + c.titulo, 0) * 1000), 1000);
});

test('cenários: o otimista tem mais pontos e mais chance de título que o realista, e este que o pessimista', () => {
  const prev = preverCompeticao(montarModelo(basquete()), { simulacoes: 500 });
  const c = cenarios(prev, 'eng');
  assert.ok(c.otimista.pontos > c.realista.pontos && c.realista.pontos > c.pessimista.pontos);
  assert.ok(c.otimista.titulo >= c.realista.titulo && c.realista.titulo >= c.pessimista.titulo);
  assert.ok(c.otimista.posicao <= c.pessimista.posicao);
  assert.equal(c.realista.tabela.length, 13);
});
