# Azven Catálogo

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
`src/lib/demo-data.ts` / `supabase/seed.sql`.

Stack: Next.js 16 (App Router, Server Actions) + Supabase (Postgres, Auth,
Storage) + Tailwind CSS 4. Hospedagem recomendada: Vercel.

---

## Rodar localmente

```bash
npm install
npm run dev
```

Sem variáveis de ambiente o site abre em **modo demonstração**, com os
produtos da Sobremesas Sofi, e o painel fica desligado. É útil para
mostrar o layout ao cliente antes de configurar qualquer coisa.

## Colocar no ar para um cliente

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **SQL Editor → New query**: cole `supabase/schema.sql` inteiro e rode.
   Isso cria as tabelas, as regras de segurança e o bucket de fotos.
3. Rode `supabase/seed.sql` para começar com os produtos e fotos da loja.
4. **Authentication → Sign In / Providers**:
   - desligue **Allow new users to sign up** (ninguém cria conta sozinho);
   - em Email, deixe **Confirm email** ligado.
5. **Authentication → Users → Add user**: crie o usuário do dono da loja
   (e-mail + senha forte, marque *Auto Confirm User*).
6. Dê acesso de admin a esse usuário no SQL Editor:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'dono@loja.com.br';
   ```

### 2. Vercel

1. Importe o repositório na Vercel.
2. Em **Environment Variables**, adicione (Supabase → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Depois aponte o domínio do cliente.

O cliente acessa `https://dominio-do-cliente/admin` para entrar no painel.

### Remover um admin

```sql
delete from public.admins
where user_id = (select id from auth.users where email = 'ex-funcionario@loja.com.br');
```

Para esquecimento de senha: **Authentication → Users → ⋯ → Send password
recovery**, ou defina uma senha nova pelo próprio Supabase.

---

## Segurança

O sistema foi feito para que, mesmo que alguém descubra o endereço do
Supabase e a chave pública, não consiga alterar nada.

| Camada | O que faz |
| --- | --- |
| **RLS no banco** | Toda tabela tem Row Level Security. Visitantes só *leem* o que está visível. Criar, editar e excluir exige estar na tabela `admins` — a regra vale dentro do Postgres, não só no site. |
| **Sem chave secreta** | O app usa apenas a chave pública (anon). A `service_role` nunca é usada nem precisa existir na Vercel. |
| **Admin conferido em toda ação** | Cada página e cada Server Action do painel confere no servidor do Supabase se o usuário está logado *e* é admin (`requireAdmin`). O redirecionamento do `proxy.ts` é só conveniência. |
| **Catálogo isolado da sessão** | O catálogo público usa um cliente sem cookies, então um admin logado nunca vê nem expõe produtos ocultos por engano. |
| **Validação no servidor** | Todos os campos passam por `zod` (tamanhos, formatos, valores) e o banco repete os limites com `CHECK`. |
| **Upload de fotos seguro** | A foto é aberta e **regravada** como WebP pelo `sharp`: tira metadados (GPS do celular), descarta qualquer conteúdo escondido e limita tamanho e resolução. O bucket também restringe tipo e tamanho. Nomes de arquivo são aleatórios. |
| **CSP com nonce** | `Content-Security-Policy` estrita por requisição: só scripts do próprio site com nonce, sem `eval` em produção, sem iframes de terceiros (`frame-ancestors 'none'`). |
| **Cabeçalhos** | HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `COOP`. Painel com `no-store` e `noindex`. |
| **CSRF** | Server Actions do Next.js recusam requisições de outra origem. |
| **Login** | Mensagem de erro genérica (não revela se o e-mail existe), cadastro público desligado e limite de tentativas do Supabase Auth. Senha nova exige 10+ caracteres com letras e números. |

Recomendações extras para produção:

- Ative **MFA** para as contas da equipe Azven no Supabase e na Vercel.
- Em **Authentication → Rate Limits**, mantenha os limites padrão (ou reduza).
- Em **Authentication → Attack Protection**, ative CAPTCHA se a loja for alvo.
- Mantenha as dependências atualizadas (`npm outdated`, Dependabot).

---

## Estrutura

```
src/
  proxy.ts                    CSP com nonce + renovação da sessão do painel
  app/
    page.tsx                  catálogo público
    admin/
      actions.ts              todas as Server Actions (login, produtos, categorias, loja)
      login/                  tela de login
      (painel)/               páginas protegidas do painel
  components/
    catalog/                  catálogo, sacola, ficha do produto, mensagem do WhatsApp
    admin/                    formulários, upload de foto, componentes do painel
  lib/
    auth.ts                   requireAdmin()
    catalog.ts                leitura pública do catálogo (ou dados de demonstração)
    upload.ts                 validação e regravação das fotos
    validation.ts             esquemas zod
supabase/
  schema.sql                  tabelas, RLS, bucket e policies
  seed.sql                    dados de exemplo (opcional)
```

## Personalizar para outro cliente

- **Cores e fontes**: `src/app/globals.css` (bloco `@theme`) e `src/app/layout.tsx`.
- **Textos do pedido no WhatsApp**: `src/components/catalog/order.ts`.
- **Formas de pagamento**: `src/components/catalog/order.ts` e `CartPanel.tsx`.
- Todo o resto (nome, capa, produtos, preços, horários) o próprio cliente
  muda pelo painel.
