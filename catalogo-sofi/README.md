# Catálogo Sobremesas Sofi (Azven)

Catálogo digital para confeitarias, docerias e restaurantes. O cliente final
monta a sacola e envia o pedido pronto pelo WhatsApp. A loja tem um painel
para cadastrar produtos, trocar fotos e preços, pausar pedidos e mais.

- **Catálogo público** (`/`): capa, destaques, categorias com atalhos, busca,
  ficha do produto com observação ("escrever Parabéns, Ana"), sacola,
  entrega ou retirada, forma de pagamento e envio do pedido pelo WhatsApp.
- **Painel** (`/admin`): produtos (foto, preço, preço promocional, porção,
  etiquetas, disponível/esgotado, visível/oculto, destaque, ordem),
  categorias, dados da loja (WhatsApp, horário, endereço, taxa de entrega,
  pedido mínimo, capa) e troca de senha.

**Cliente atual: Sobremesas Sofi** (@Sobremesas_Sofi). Cores da marca em
`src/app/globals.css`, fotos e logo em `public/sofi/` e produtos iniciais em
`src/lib/demo-data.ts`.

Stack: Next.js 16 (App Router, Server Actions) + Vercel Blob (privado) +
Tailwind CSS 4, hospedado na Vercel.

---

## Como funciona (Sobremesas Sofi)

- **Site:** https://sobremesas-sofi.vercel.app (projeto `sobremesas-sofi` na Vercel,
  Root Directory `catalogo-sofi`). Cada push neste branch publica sozinho.
- **Painel:** https://sobremesas-sofi.vercel.app/admin (usuário `sofi`).
- **Dados:** Vercel Blob **privado** `sobremesas-sofi-dados`:
  - `data/catalog.json`: configurações, categorias e produtos;
  - `data/auth.json`: hash da senha, criado quando ela é trocada pelo painel;
  - `media/...`: fotos enviadas, servidas pela rota `/media/...`.
  Enquanto ninguém salvar nada, o site usa os dados iniciais de `src/lib/demo-data.ts`.

### Variáveis de ambiente (Vercel)

| Variável | O que é |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Criada sozinha ao conectar o Blob |
| `ADMIN_USER` | Usuário do painel (`sofi`) |
| `ADMIN_PASSWORD_HASH` | Hash scrypt da senha inicial (`node scripts/hash-password.mjs 'senha'`) |
| `SESSION_SECRET` | Chave aleatória das sessões (`openssl rand -base64 48`) |

**Esqueceu a senha?** Gere um hash novo, troque `ADMIN_PASSWORD_HASH` na Vercel,
apague `data/auth.json` do Blob (Storage → sobremesas-sofi-dados) e faça redeploy.

### Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha; use LOCAL_STORE_DIR=./.data
npm run dev
```

---

## Segurança

| Camada | O que faz |
| --- | --- |
| **Dados privados** | O Blob é privado: só o servidor, com o token, lê ou grava. O navegador nunca recebe o token. |
| **Senha** | Guardada só como hash scrypt (com salt). Nem a Vercel nem o código têm a senha em texto. |
| **Sessão** | Cookie `httpOnly`, `Secure`, `SameSite=Strict`, assinado com HMAC-SHA256 e válido por 7 dias. Trocar a senha derruba todas as outras sessões. |
| **Força bruta** | 5 senhas erradas seguidas bloqueiam por 15 minutos, mais espera fixa e o custo do scrypt em cada tentativa. |
| **Admin conferido em toda ação** | Cada página e cada Server Action do painel valida a sessão (`requireAdmin`). O redirecionamento do `proxy.ts` é só conveniência. |
| **Edições simultâneas** | Gravação condicional (ETag): duas pessoas editando ao mesmo tempo não apagam a alteração uma da outra. |
| **Validação** | Todos os campos passam por `zod` (tamanhos, formatos, valores). |
| **Fotos** | Regravadas como WebP pelo `sharp`, sem metadados (GPS) nem conteúdo escondido, com nome aleatório. A rota `/media` só entrega caminhos de foto no formato exato. |
| **CSP com nonce** | Só scripts do próprio site, sem `eval` em produção, sem iframes (`frame-ancestors 'none'`). |
| **Cabeçalhos** | HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP. Painel com `no-store` e `noindex`. |
| **CSRF** | Server Actions do Next.js recusam requisições de outra origem. |

## Estrutura

```
src/
  proxy.ts                    CSP com nonce + redirecionamento do painel
  app/
    page.tsx                  catálogo público
    media/[...path]/route.ts  entrega as fotos enviadas (Blob privado)
    admin/
      actions.ts              todas as Server Actions (login, produtos, categorias, loja)
      login/                  tela de login
      (painel)/               páginas protegidas do painel
  components/
    catalog/                  catálogo, sacola, ficha do produto, mensagem do WhatsApp
    admin/                    formulários, upload de foto, componentes do painel
  lib/
    auth.ts                   login, sessão assinada, requireAdmin(), troca de senha
    password.ts               hash scrypt da senha
    store.ts                  leitura/gravação no Blob privado (ou pasta local)
    catalog.ts                leitura pública do catálogo
    upload.ts                 validação e regravação das fotos
    validation.ts             esquemas zod
scripts/
  hash-password.mjs           gera o ADMIN_PASSWORD_HASH
```

## Personalizar para outro cliente

- **Cores e fontes**: `src/app/globals.css` (bloco `@theme`) e `src/app/layout.tsx`.
- **Textos do pedido no WhatsApp**: `src/components/catalog/order.ts`.
- **Formas de pagamento**: `src/components/catalog/order.ts` e `CartPanel.tsx`.
- Todo o resto (nome, capa, produtos, preços, horários) o próprio cliente
  muda pelo painel.
