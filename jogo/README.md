# 🥑 HortaPop

Jogo para **aprender em inglês os nomes de frutas, legumes, verduras e temperos**,
feito para usar no celular. Suporta **vários perfis no mesmo aparelho** — cada pessoa
escolhe (ou cria) seu perfil e joga com seu próprio progresso, separado dos outros.

A interface é em **português**; o conteúdo a ser aprendido é em **inglês**.

## Como abrir no celular

1. Publique a pasta (ou o repositório) em qualquer host estático — por exemplo GitHub Pages.
2. No celular, abra `.../jogo/`.
3. Instale como aplicativo:
   - **Android (Chrome):** menu ⋮ → *Adicionar à tela inicial*
   - **iPhone (Safari):** botão compartilhar → *Adicionar à Tela de Início*

Depois de instalado ele abre em tela cheia, sem barra do navegador, e **funciona sem internet**
(um service worker guarda tudo no aparelho). O progresso fica salvo no próprio celular.

Também funciona abrindo o `index.html` direto do arquivo — só o modo offline instalado
(service worker) precisa de um servidor.

## Perfis

Na primeira vez, o jogo pergunta "Quem vai jogar?" — toque em *Novo perfil*, escolha um
nome e um emoji. O progresso de cada perfil (fases, estrelas, pontos, memória de cada
palavra) fica isolado dos demais. Para trocar de perfil depois, toque no emoji redondo
ao lado da engrenagem na tela inicial, ou em Ajustes → Perfil → *Trocar*. Dá para editar
o nome/emoji ou excluir um perfil a qualquer momento (ícone de lápis no card do perfil).

Importante: **isso não é uma conta online**. Os perfis ficam salvos só neste aparelho/
navegador — trocar de celular ou limpar os dados do navegador não leva o progresso junto.
Quem já jogava antes dos perfis existirem não perde nada: na primeira abertura depois da
atualização, o progresso antigo vira automaticamente o primeiro perfil ("Jogador 1").

## O que tem dentro

- **82 palavras**: frutas, legumes, verduras e temperos verdes, com tradução,
  pronúncia escrita em português (ex.: *strawberry* → “STRÓ-be-ri”) e frase de exemplo.
- **14 fases** temáticas + desafio final, com estrelas, pontos, XP, nível e dias seguidos.
- **7 tipos de exercício**, misturados de propósito:
  | Exercício | O que treina |
  |---|---|
  | Ver a imagem → escolher o nome | reconhecer |
  | Ouvir → escolher a imagem | escutar |
  | Só a **sombra** → adivinhar | reconhecer a **forma** |
  | Português → inglês | traduzir |
  | Inglês → português | entender |
  | Montar a palavra com letrinhas | **escrever** (dá para apagar e só confere quando você manda) |
  | Digitar a palavra no teclado | **escrever do zero** |
- **Repetição espaçada**: cada palavra tem uma "força de memória"; o que você acerta
  volta cada vez mais tarde, o que erra volta em minutos (botão *Revisão*).
- **Dicionário** com todas as palavras, áudio normal e devagar, e barra de memória.
- **Voz** em inglês (Web Speech API), sons, vibração — tudo desligável nos ajustes.

## Arquivos

| Arquivo | O quê |
|---|---|
| `index.html` | telas e estilo |
| `data.js` | as 82 palavras e as fases |
| `art.js` | desenha cada fruta/legume em SVG por código (inclui o modo sombra) |
| `game.js` | jogo, pontuação, repetição espaçada, progresso |
| `sw.js`, `manifest.webmanifest`, `icon*` | instalação como app e uso offline |

Nenhuma imagem externa, nenhuma biblioteca, nenhuma conta: são ~130 KB de arquivos estáticos.

## Mudar ou acrescentar palavras

Basta editar `data.js`. Cada item é assim:

```js
{ id:'mango', en:'Mango', pt:'Manga', ph:'MÉN-gou', cat:'fruit', emoji:'🥭',
  art:{ s:'mango', c:'#f2a03d' },
  ex:'Mango is my favorite fruit.', exPt:'Manga é minha fruta favorita.' }
```

`art.s` é o nome de uma das formas de `art.js` (`apple`, `citrus`, `cluster`, `pod`,
`leaves`, `sprig`, …) e `art.c` é a cor. Depois é só incluir o `id` em alguma fase de `LEVELS`.
