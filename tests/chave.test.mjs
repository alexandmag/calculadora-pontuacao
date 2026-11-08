import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESPORTES, ETAPA, NOME_ETAPA, classificacaoColetiva, jogosQueContam } from '../js/regras.js';
import { MODALIDADE } from '../js/dados.js';
import { montarModelo } from '../js/modelo.js';
import { dadosDoResumo } from '../js/resumo.js';

let seq = 0;
const jogo = (fase, a, b, res = null, extra = {}) => ({ id: `c${++seq}`, mod: 'peteca-f', fase, grupo: null, a, b, res, data: '2026-11-08', hora: '', local: '', ...extra });
const v = { a: 2, b: 0 }; // lado A vence por 2 sets a 0
const d = { a: 0, b: 2 }; // lado B vence
const peteca = ESPORTES.peteca;

// Chave da peteca feminina de 2026: 3 jogos de oitavas, as outras 5 entram direto nas quartas.
function chaveCompleta() {
  return [
    jogo('oitavas', 'ich', 'dir', d), // Direito
    jogo('oitavas', 'odo', 'bio', v), // Manada
    jogo('oitavas', 'psi', 'com', v), // Alfa
    jogo('quartas', 'dir', 'med', v), // Direito
    jogo('quartas', 'eng', 'ef', v), // Engenharia
    jogo('quartas', 'odo', 'ger', d), // Vinkão
    jogo('quartas', 'psi', 'ics', d), // Vikings ICS
    jogo('semifinal', 'dir', 'eng', d), // Engenharia
    jogo('semifinal', 'ger', 'ics', v), // Vinkão
    jogo('final', 'eng', 'ger', { a: 2, b: 1 }), // Engenharia campeã
  ];
}

test('peteca é uma chave: oitavas → quartas → semifinal → final, sem grupos', () => {
  assert.equal(MODALIDADE['peteca-f'].chave, true);
  assert.equal(MODALIDADE['peteca-f'].tipo, 'coletiva');
  const r = classificacaoColetiva({ grupos: {}, jogos: chaveCompleta(), esporte: peteca });
  assert.equal(r.encerrada, true);
  // 3º e 4º: quem perdeu a semi para a campeã e para a vice. 5º a 8º: quem caiu nas quartas, na ordem
  // de quem as eliminou (Engenharia 1ª, Vinkão 2ª, Direito 3ª, Vikings ICS 4ª). 9º a 11º: oitavas, idem.
  assert.deepEqual(
    r.ordem.map((l) => [l.id, l.posicao]),
    [
      ['eng', 1],
      ['ger', 2],
      ['dir', 3],
      ['ics', 4],
      ['ef', 5],
      ['odo', 6],
      ['med', 7],
      ['psi', 8],
      ['ich', 9],
      ['bio', 10],
      ['com', 11],
    ],
  );
  assert.equal(r.ordem.find((l) => l.id === 'ef').etapa, ETAPA.quartas);
  assert.equal(r.ordem.find((l) => l.id === 'ich').etapa, ETAPA.oitavas);
  assert.ok(r.ordem.every((l) => !l.empatado));
});

test('chave em andamento: quem passou das oitavas está nas quartas, mesmo com a vaga ainda "a definir" lá', () => {
  const jogos = [
    jogo('oitavas', 'ich', 'dir', d),
    jogo('oitavas', 'odo', 'bio'),
    jogo('quartas', '', 'med', null, { aRotulo: 'Vencedor de Ursal × Direito' }),
    jogo('quartas', 'eng', 'ef'),
    jogo('quartas', '', 'ger', null, { aRotulo: 'Vencedor de Manada × Raptors' }),
  ];
  const r = classificacaoColetiva({ grupos: {}, jogos: jogosQueContam(jogos), todos: jogos, esporte: peteca });
  const etapa = Object.fromEntries(r.ordem.map((l) => [l.id, l.etapa]));
  assert.equal(etapa.dir, ETAPA.naQuartas);
  assert.equal(etapa.ich, ETAPA.oitavas);
  assert.equal(etapa.odo, ETAPA.naOitavas);
  assert.equal(etapa.eng, ETAPA.naQuartas);
  // Med e Vinkão ainda não têm adversário definido: só aparecem quando a vaga for preenchida.
  assert.equal(etapa.med, undefined);
  assert.equal(r.encerrada, false);
  assert.equal(NOME_ETAPA[ETAPA.naQuartas], 'Nas quartas');
  assert.equal(NOME_ETAPA[ETAPA.oitavas], 'Parou nas oitavas');
  // Quem segue vivo vem antes de quem já caiu.
  assert.ok(r.ordem.findIndex((l) => l.id === 'ich') > r.ordem.findIndex((l) => l.id === 'odo'));
});

test('chave no modelo: sem colocação antes da final; agenda e resumo mostram a fase e o "a definir"', () => {
  const estado = { config: { geral: { nossa: 'eng' } }, modalidades: {}, jogos: {}, resultados: {}, penalidades: {} };
  const jogos = [
    jogo('oitavas', 'eng', 'ger', null, { mod: 'peteca-m', hora: '' }),
    jogo('quartas', '', 'med', null, { mod: 'peteca-m', aRotulo: 'Vencedor de Capetas × Vinkão' }),
  ];
  for (const j of jogos) estado.jogos[j.id] = j;
  const m = montarModelo(estado);
  const info = m.modalidades['peteca-m'];
  assert.equal(info.vigente.length, 0);
  assert.equal(info.jogos.length, 2);
  const r = dadosDoResumo(m, 'eng', '2026-11-08');
  assert.deepEqual(
    r.itens.map((i) => [i.modalidade, i.fase, i.adversario]),
    [['Peteca Masculino', 'Oitavas de final', 'Gerenciais']], // nome padrão (sem apelido na config)
  );
  // Com o resultado, a vencedora passa a estar nas quartas, mas a modalidade só dá colocação depois da final.
  estado.jogos[jogos[0].id].res = v;
  const m2 = montarModelo(estado);
  assert.equal(m2.modalidades['peteca-m'].vigente.length, 0);
  assert.equal(m2.modalidades['peteca-m'].andamento.find((l) => l.id === 'eng').etapa, ETAPA.naQuartas);
});

test('fases de cada modalidade: a chave não tem grupos nem repescagem; as outras coletivas não têm oitavas nem quartas', async () => {
  const { fasesDaModalidade } = await import('../js/dados.js');
  const ids = (m) => fasesDaModalidade(m).map((f) => f.id);
  assert.deepEqual(ids(MODALIDADE['peteca-m']), ['oitavas', 'quartas', 'semifinal', 'final']);
  assert.deepEqual(ids(MODALIDADE['futsal-m']), ['grupo', 'repescagem', 'semifinal', 'final']);
  assert.equal(ids(undefined).length, 6);
});
