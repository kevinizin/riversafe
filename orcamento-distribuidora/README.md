# Gerador de orçamentos para distribuidora

Site estático — HTML, CSS e JavaScript sem build, sem dependência. Publicado no
Vercel direto da pasta. A empresa da demonstração é a **Vértice Distribuidora**,
fictícia.

## A marca é dado, não código

Tudo que identifica a empresa mora em **um objeto**: `EMPRESA`, em
`js/dados.js`. Cabeçalho, documento impresso, texto de WhatsApp, título da aba,
ícone e as cores do sistema inteiro leem dali. Para colocar o sistema na cara
de um cliente real:

1. Edite `EMPRESA` em `js/dados.js` — nome, razão social, CNPJ, contato, slogan.
2. Troque as duas cores em `EMPRESA.marca.cores`. O app deriva os tons claros e
   escuros ao iniciar (`aplicarMarca()` em `js/app.js`), então botões, foco,
   faixas e o documento acompanham sem mexer em CSS.
3. Salve a logo do cliente em `img/logo.png` (fundo transparente) e uma versão
   clara em `img/logo-negativa.png` para o cabeçalho escuro. Ícone da aba em
   `img/icone.png`. Sem arquivo de logo, o nome aparece escrito — nunca um
   ícone de imagem quebrada.
4. Troque `PRODUTOS` pelo catálogo dele.

Nada mais precisa ser editado. `css/app.css` só conhece os tokens
`--primaria-*` e `--destaque-*`; não há hexadecimal de marca fora do bloco
`:root`.

## Pastas

- `index.html`, `css/`, `js/` — o aplicativo.
- `img/` — logo (positiva e negativa), ícones.
- `marca/` — a identidade: logo original, guia (`identidade-vertice.md`) e uma
  página de referência (`logo.html`) com a logo nos tamanhos usados e a paleta.
- `exemplo-orcamento.pdf` — um orçamento gerado pelo próprio sistema.

## Publicar

```
vercel --prod
```

da pasta, como da primeira vez. O cache de `img/` é de um dia (não um ano),
justamente para a logo de um cliente novo aparecer sem precisar renomear o
arquivo.
