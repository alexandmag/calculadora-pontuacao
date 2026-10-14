import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarModelo } from '../js/modelo.js';

const vazio = () => ({ config: {}, modalidades: {}, jogos: {}, resultados: {}, penalidades: {} });
const jogoDeGrupo = (a, b, res = null) => ({ mod: 'futsal-m', fase: 'grupo', grupo: 'A', a, b, data: '', hora: '', local: '', res });

test('modalidade com grupos montados mas sem resultado não dá pontos na projeção', () => {
  const estado = vazio();
  estado.modalidades['futsal-m'] = { grupoDe: { ef: 'A', eng: 'A', med: 'B', dir: 'B' } };
  estado.jogos.j1 = jogoDeGrupo('ef', 'eng');
  estado.jogos.j2 = { ...jogoDeGrupo('med', 'dir'), grupo: 'B' };
  const modelo = montarModelo(estado);
  assert.ok(modelo.geral.projecao.every((l) => l.total === 0));
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

test('com o primeiro resultado lançado, a projeção começa a contar', () => {
  const estado = vazio();
  estado.modalidades['futsal-m'] = { grupoDe: { ef: 'A', eng: 'A', med: 'B', dir: 'B' } };
  estado.jogos.j1 = jogoDeGrupo('ef', 'eng', { a: 0, b: 2 });
  const modelo = montarModelo(estado);
  const eng = modelo.geral.projecao.find((l) => l.id === 'eng');
  assert.equal(eng.posicao, 1);
  assert.equal(eng.total, 12);
  assert.equal(modelo.modalidades['futsal-m'].estado, 'andamento');
});
