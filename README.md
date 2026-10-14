# Placar INTERPUC

App para a atlética acompanhar a pontuação do **INTERPUC Minas 11ª Edição (2026)**: jogos, grupos, provas
individuais e a classificação geral das 13 atléticas, seguindo o regulamento do campeonato.

- **Sem login.** Quem tem o link abre no celular, vê tudo e lança resultados.
- **Compartilhado e ao vivo.** Um diretor lança o placar na quadra e os outros veem na hora.
- **Datas soltas.** Jogo pode ficar sem data e um dia inteiro pode ser remarcado de uma vez (chuva).
- **Projeção a qualquer momento.** A geral mostra quem seria campeã se o campeonato acabasse agora.

## Como usar

1. **Ajustes** → escolha a sua atlética (fica destacada em todo o app) e, se quiser, troque os nomes das atléticas pelos apelidos que vocês usam.
2. **Modalidades** → numa coletiva, toque em **Montar grupos** e marque o grupo de cada atlética. O app cria todos os jogos de cada grupo.
3. **Jogos** → toque num jogo para marcar data, hora e local e, depois, lançar o placar. Choveu? **Remarcar dia** move todos os jogos pendentes daquele dia.
4. Repescagem (onde houver), semifinais e final → **Adicionar jogo** na página da modalidade. Não há oitavas nem quartas.
5. Atletismo, natação, tênis, judô e jiu-jitsu → lance quem ficou do 1º ao 8º em cada prova, chave ou categoria.
6. Quando a CO divulgar a classificação final de uma modalidade, **Confirme como oficial** (ou lance à mão).
7. **Geral** → *Projeção* soma tudo o que já foi lançado; *Só oficiais* conta apenas as classificações confirmadas.

Faça um backup em **Ajustes → Baixar backup** no fim de cada dia de jogos.

## Regras usadas

| O quê | Regra | Onde |
|---|---|---|
| Pontos na geral | 12, 9, 7, 5, 4, 3, 2, 1 do 1º ao 8º de cada modalidade | RG Art. 13 |
| Desempate da geral | Mais 1º lugares, depois 2º… até o 11º; depois sorteio | RG Art. 15 |
| W.O. | Sai da modalidade, resultados cancelados, sem pontos nela e −12 na geral | RG Art. 27 |
| Fraude na inscrição | −80 na geral | RG Art. 23 |
| Futsal e futebol | Vitória 3, empate 1; desempate: vitórias, saldo, confronto direto, gols pró, gols contra, vermelhos, amarelos | A1 Arts. 16 e 36 |
| Handebol | Vitória 2, empate 1; desempate: vitórias, saldo, confronto direto, gols sofridos, gols marcados, vermelhos | A1 Art. 10 |
| Basquete | Vitória 1, sem empate; desempate: vitórias, saldo, confronto direto, pontos feitos, pontos sofridos | A1 Art. 22 |
| Vôlei | 2×0 vale 3 a 0; 2×1 vale 2 a 1; saldo pelos pontos das parciais | A1 Art. 28 |
| 3º e 4º nas coletivas | Não há disputa de 3º: 3º é quem perdeu a semifinal para a campeã, 4º quem perdeu para a vice | Regra da CO |
| Placar de W.O. | Futsal 1×0, futebol 3×0, handebol 15×0, basquete 20×0, vôlei 2×0 (25×0, 25×0) | Anexo 1 |
| Provas, chaves e lutas | 12…1 por prova do 1º ao 8º; revezamento em dobro; desempate por número de 1º, 2º… lugares | A1 Arts. 41–43, 52–54, 66–67, 76–77, 89–95 |
| Limite por prova | Mais atletas que o permitido zera a atlética na prova | A1 Arts. 38 e 49 |

### O que o regulamento não define (e o que o app faz)

- **Colocações do 5º em diante nas coletivas.** O caminho é grupos → repescagem (onde houver) → semifinal → final. Assim que a fase final começa, o líder de cada grupo (nas modalidades com repescagem) ou os dois primeiros (nas sem repescagem) já contam como semifinalistas. Quem perdeu a repescagem vem logo depois dos quatro semifinalistas. Quem não passou dos grupos é ordenado pela posição no grupo e depois pela campanha (aproveitamento, saldo e gols pró por jogo). Enquanto uma fase não acaba, quem segue vivo é ordenado pela campanha. É uma **projeção**: confirme ou ajuste quando sair a oficial.
- **W.O. técnico.** O RG Art. 27 §2º diz “salvo a perda de 12 pontos”. O app lê como *exceto*, então o W.O. técnico tira a atlética da modalidade mas não desconta 12. Dá para mudar em Ajustes.
- **Jogos de quem deu W.O.** Os jogos anteriores da atlética são cancelados; o jogo do W.O. vale para o adversário com o placar do Anexo 1.
- **Peteca.** Sem pontos de grupo nem desempate no regulamento: o app usa os do vôlei.
- **Cartões e sorteio.** Cartões são opcionais no lançamento. Empate em todos os critérios aparece com ≈ e precisa ser resolvido à mão (sorteio).

## Colocar no ar (GitHub Pages)

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e salve.
3. Em cerca de um minuto o app fica em `https://alexandmag.github.io/calculadora-pontuacao/`.

Sem o Firebase configurado, o app funciona em **modo local**: os dados ficam só no aparelho de quem usa.

## Compartilhar os dados com a diretoria (Firebase)

O Firebase é o banco gratuito do Google que guarda os dados e entrega ao vivo para todo mundo.

**Já está configurado:** o app usa o projeto `placar-interpuc` (Firestore em São Paulo, plano gratuito), com as
regras de [`firestore.rules`](firestore.rules) publicadas. Os passos abaixo só servem para recriar o banco do zero.

1. Acesse <https://console.firebase.google.com> com uma conta Google e crie um projeto (ex.: `placar-interpuc`). O Google Analytics pode ficar desligado.
2. Menu **Criação → Firestore Database → Criar banco de dados**. Local: `southamerica-east1 (São Paulo)`. Modo: produção.
3. Na aba **Regras** do Firestore, apague o que estiver lá, cole o conteúdo do arquivo [`firestore.rules`](firestore.rules) e clique em **Publicar**.
4. Volte à **Visão geral do projeto**, clique no ícone **`</>`** (Web), dê um apelido e registre o app (não precisa do Hosting).
5. Copie os dados de `firebaseConfig` que aparecem e cole em [`js/firebase-config.js`](js/firebase-config.js), no lugar de `null`:

   ```js
   export const firebaseConfig = {
     apiKey: '…',
     authDomain: '…',
     projectId: '…',
     storageBucket: '…',
     messagingSenderId: '…',
     appId: '…',
   };
   ```

6. Faça o commit e o push. O topo do app passa a mostrar **Ao vivo**.

Esses dados do Firebase não são senha: foram feitos para ficar no site. Como não há login, qualquer pessoa com o link
pode editar. Por isso, compartilhe o link só com a diretoria e faça backups.

## Desenvolvimento

Precisa só do Node.js (sem dependências para instalar).

```bash
npm run dev
```

Abre o app em <http://localhost:5173>.

```bash
npm test
```

Roda os testes das regras de pontuação.

| Arquivo | O que tem |
|---|---|
| `js/regras.js` | Regras do regulamento, só cálculo (testadas em `tests/`) |
| `js/dados.js` | Atléticas, modalidades, formatos dos grupos, provas e dias de jogos |
| `js/modelo.js` | Junta os dados lançados com as regras e calcula tabelas e classificações |
| `js/armazenamento.js` | Firebase (compartilhado) ou armazenamento do aparelho (local) |
| `js/telas.js`, `js/folhas.js`, `js/acoes.js` | Telas, formulários de lançamento e ações dos botões |
