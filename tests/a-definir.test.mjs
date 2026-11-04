import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarModelo } from '../js/modelo.js';
import { preverCompeticao } from '../js/previsao.js';
import { previsaoObjetiva, situacaoModalidade } from '../js/situacao.js';
import { dadosDoResumo } from '../js/resumo.js';
import { jogosQueContam } from '../js/regras.js';

const SABADO = '2026-11-07';

// Futsal masculino como no sábado 07/11: grupos B e C terminaram, o A ainda tem um jogo, e a repescagem
// já tem horário, com o 2º do grupo A ainda "a definir".
function futsal() {
  const estado = { config: { geral: { nossa: 'eng', nomes: { eng: 'Capetas', ics: 'Vikings ICS' } } }, modalidades: {}, jogos: {}, resultados: {}, penalidades: {} };
  estado.modalidades['futsal-m'] = { grupoDe: { com: 'A', dir: 'A', psi: 'A', ef: 'B', eng: 'B', ger: 'B', med: 'C', ics: 'C', icei: 'C' } };
  const grupos = { A: ['com', 'dir', 'psi'], B: ['ef', 'eng', 'ger'], C: ['med', 'ics', 'icei'] };
  const placar = { 'ef-eng': [3, 1], 'ef-ger': [3, 0], 'eng-ger': [3, 0], 'med-ics': [6, 2], 'med-icei': [2, 1], 'ics-icei': [4, 2], 'com-dir': [1, 2], 'com-psi': [5, 3] };
  for (const [letra, ids] of Object.entries(grupos)) {
    ids.forEach((x, i) =>
      ids.slice(i + 1).forEach((y) => {
        const p = placar[`${x}-${y}`];
        estado.jogos[`${x}-${y}`] = { mod: 'futsal-m', fase: 'grupo', grupo: letra, a: x, b: y, data: '', hora: '', local: '', res: p ? { a: p[0], b: p[1] } : null };
      }),
    );
  }
  const rep = (id, a, b, hora, extra = {}) => {
    estado.jogos[id] = { mod: 'futsal-m', fase: 'repescagem', grupo: null, a, b, data: SABADO, hora, local: 'Quadra 5', res: null, ...extra };
  };
  rep('r1', 'ics', '', '10:00', { bRotulo: '2º do Grupo A' });
  rep('r2', 'eng', 'ics', '12:00');
  rep('r3', 'eng', '', '14:00', { bRotulo: '2º do Grupo A' });
  return estado;
}

test('jogo com lado a definir não conta, e a repescagem só começa completa', () => {
  const jogos = Object.values(futsal().jogos);
  const contam = jogosQueContam(jogos);
  assert.equal(contam.filter((j) => j.fase === 'repescagem').length, 0, 'repescagem pela metade não conta');
  assert.equal(contam.length, 9, 'os 9 jogos de grupo contam');
  // Com os três times definidos, a repescagem inteira passa a contar.
  const completos = jogos.map((j) => (j.fase === 'repescagem' && !j.b ? { ...j, b: 'dir' } : j));
  assert.equal(jogosQueContam(completos).filter((j) => j.fase === 'repescagem').length, 3);
});

test('repescagem com lado a definir não elimina quem ainda joga no grupo', () => {
  const modelo = montarModelo(futsal());
  const info = modelo.modalidades['futsal-m'];
  assert.equal(info.jogos.length, 12, 'os jogos da repescagem continuam na agenda');
  assert.equal(info.tabelaRepescagem, null);
  const sit = situacaoModalidade(info);
  assert.equal(sit.mataMata, false, 'a fase final ainda não começou');
  // No grupo A falta Direito x Alfa: Direito e Alfa ainda podem ir à repescagem.
  for (const id of ['dir', 'psi']) assert.notEqual(sit.times[id].destino, 'fora', id);
  assert.equal(sit.times.eng.destino, 'repescagem');
  const prev = preverCompeticao(modelo, { simulacoes: 200 });
  const objetivo = Object.fromEntries(['dir', 'psi', 'eng'].map((id) => [id, previsaoObjetiva(modelo, prev, id).find((o) => o.mod === 'futsal-m')]));
  assert.notEqual(objetivo.dir.categoria, 'fora');
  assert.notEqual(objetivo.psi.categoria, 'fora');
  assert.equal(objetivo.eng.categoria, 'repescagem');
  // A simulação monta a repescagem pelos 2º colocados (três times), não só pelos dois já definidos.
  assert.ok(prev.modalidades['futsal-m'].eng.rivalRepescagem.ics > 0.99);
  assert.ok(Object.keys(prev.modalidades['futsal-m'].eng.rivalRepescagem).length >= 2);
});

test('o resumo do dia traz os jogos com lado a definir, com o rótulo no lugar do adversário', () => {
  const r = dadosDoResumo(montarModelo(futsal()), 'eng', SABADO);
  assert.deepEqual(
    r.itens.map((i) => [i.hora, i.adversario, i.resultado]),
    [
      ['12:00', 'Vikings ICS', 'pendente'],
      ['14:00', '2º do Grupo A', 'pendente'],
    ],
  );
});
