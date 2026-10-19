import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarModelo } from '../js/modelo.js';

const vazio = () => ({ config: {}, modalidades: {}, jogos: {}, resultados: {}, penalidades: {} });
const jogoDeGrupo = (a, b, res = null) => ({ mod: 'futsal-m', fase: 'grupo', grupo: 'A', a, b, data: '', hora: '', local: '', res });

test('modalidade com grupos montados mas sem resultado não dá pontos', () => {
  const estado = vazio();
  estado.modalidades['futsal-m'] = { grupoDe: { ef: 'A', eng: 'A', med: 'B', dir: 'B' } };
  estado.jogos.j1 = jogoDeGrupo('ef', 'eng');
  estado.jogos.j2 = { ...jogoDeGrupo('med', 'dir'), grupo: 'B' };
  const modelo = montarModelo(estado);
  assert.ok(modelo.geral.conquistados.every((l) => l.total === 0));
  assert.equal(modelo.modalidades['futsal-m'].estado, 'aguardando');
  assert.equal(modelo.modalidades['futsal-m'].participantes, 4, 'a folha de classificação ainda sabe quantas atléticas disputam');
});

test('cada aparelho pode destacar outra atlética; sem escolha, vale a da equipe', () => {
  const estado = vazio();
  estado.config.geral = { nossa: 'eng' };
  assert.equal(montarModelo(estado).nossa, 'eng');
  assert.equal(montarModelo(estado, { nossaLocal: 'med' }).nossa, 'med');
  assert.equal(montarModelo(estado, { nossaLocal: 'med' }).nossaPadrao, 'eng');
  assert.equal(montarModelo(estado, { nossaLocal: 'nao-existe' }).nossa, 'eng');
});

test('vitória na fase de grupos não vale ponto na geral: só a modalidade encerrada pontua', () => {
  const estado = vazio();
  estado.modalidades['futsal-f'] = { grupoDe: { ef: 'A', eng: 'A', med: 'B', dir: 'B' } };
  const jogo = (a, b, res, extra = {}) => ({ ...jogoDeGrupo(a, b, res), mod: 'futsal-f', ...extra });
  estado.jogos.j1 = jogo('ef', 'eng', { a: 0, b: 2 });
  let modelo = montarModelo(estado);
  assert.ok(modelo.geral.conquistados.every((l) => l.total === 0), 'grupo não dá pontos');
  assert.equal(modelo.modalidades['futsal-f'].estado, 'andamento');
  assert.deepEqual(modelo.modalidades['futsal-f'].calculada, []);
  assert.equal(modelo.modalidades['futsal-f'].andamento[0].id, 'eng', 'mas mostra até onde cada uma chegou');

  estado.jogos.j2 = jogo('med', 'dir', { a: 1, b: 0 }, { grupo: 'B' });
  estado.jogos.s1 = jogo('eng', 'dir', { a: 3, b: 1 }, { fase: 'semifinal', grupo: null });
  estado.jogos.s2 = jogo('med', 'ef', { a: 2, b: 2, penaltis: { a: 4, b: 3 } }, { fase: 'semifinal', grupo: null });
  modelo = montarModelo(estado);
  assert.ok(modelo.geral.conquistados.every((l) => l.total === 0), 'semifinal ainda não dá pontos');

  estado.jogos.f = jogo('eng', 'med', { a: 1, b: 0 }, { fase: 'final', grupo: null });
  modelo = montarModelo(estado);
  const pontos = Object.fromEntries(modelo.geral.conquistados.map((l) => [l.id, l.total]));
  assert.deepEqual([pontos.eng, pontos.med, pontos.dir, pontos.ef], [12, 9, 7, 5], '3º perdeu para a campeã, 4º para a vice');
  assert.equal(modelo.modalidades['futsal-f'].estado, 'encerrada');
});
