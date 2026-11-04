# Stage H — adaptação visual (white label) do sistema Innovi Autos

**Regra seguida:** nenhuma lógica foi alterada. Banco, migrações, Edge Functions, autenticação, permissões,
RPCs, rotas e fluxos de Check-in / Check-up / Check-out estão exatamente como estavam.
Só mudaram apresentação (CSS/JSX de layout) e dados públicos da oficina.

## O que mudou
| Área | Arquivos |
|---|---|
| Dados da oficina (nome, telefone, WhatsApp, horário, endereço configurável) | `web/src/lib/oficina.ts` |
| Tema escuro neon (paleta Stage H) | `web/src/theme-stageh.css` (novo, carregado depois de `styles.css`) |
| Logo oficial | `web/src/components/Brand.tsx`, `web/public/brand/logo-stageh.png`, ícones PWA/favicon |
| Foto do Civic (recorte da arte de referência, sem letreiro/faixa/selo de terceiros) | `web/public/brand/civic-ek-stage-h.webp` |
| Civic 3D 360° (abre pelo botão "Girar 360°") | `web/src/components/Civic3D.tsx`, `CivicStage.tsx` (carregamento sob demanda) |
| Painel (hero, faixa de contato, Resumo da Oficina) | `web/src/pages/Painel.tsx` (mesmas RPCs: `dashboard_summary`, `recent_activity`) |
| Barra lateral, topo mobile, login, documentos | `Layout.tsx`, `Login.tsx`, `DocShell.tsx` |
| Site público | `site/SiteLayout.tsx`, `SiteHome.tsx`, `SiteContato.tsx` |
| Config | `index.html`, `vite.config.ts` (manifesto PWA), `vercel.json`, `package.json`, `.env.example` |

Textos "Innovi Autos" visíveis ao usuário foram trocados (fichas/orçamentos, assinaturas, mensagens de WhatsApp,
consentimento LGPD, título da aba). Os documentos A4 continuam brancos para impressão/PDF.

## Preservado de propósito (não renomear)
Chave de sessão `innovi-auth`, banco IndexedDB da fila offline `innovi-offline`, domínio técnico de login
`usuarios.innoviautos.internal`, nomes de tarefas/configurações no banco. Renomear derrubaria sessões, perderia
fotos na fila e quebraria os logins existentes. O usuário nunca vê esses nomes.

## Pendências (precisam de informação da oficina)
1. **Endereço**: nenhum foi inventado. Preencher `VITE_OFICINA_ENDERECO`, `VITE_OFICINA_BAIRRO`, `VITE_OFICINA_CEP`
   (Vercel ou `.env.local`). Enquanto vazio, site e documentos omitem a linha; no painel aparece "Não configurado".
2. **Modelo 3D realista**: colocar `web/public/models/civic-ek.glb` (ver `web/public/models/LEIA-ME.txt`).
3. **Logo em alta resolução**: o arquivo recebido tem 142×54 px. Foi isolado do fundo e ampliado 4×, mas fica
   macio em telas grandes. O ideal é PNG transparente ou SVG em alta.
4. **Backend**: Supabase/Edge Functions ainda são os do projeto Innovi. Para a Stage H, criar projeto próprio
   (aplicar `supabase/migrations`) e ajustar `.env.local`, `APP_ALLOWED_ORIGINS` (CORS) e o domínio.
5. **Feriados/cidade**: o indicador "aberto agora" usa feriados de SP e de Guarulhos (`oficina.ts`).
6. Lista de serviços e formas de pagamento do site ainda são as da Innovi; confirmar com a Stage H.

## Para rodar
```
cd web
npm install          # necessário uma vez: adiciona three@0.169.0 e @types/three (atualiza o package-lock)
npm run dev
npm run typecheck && npm run build
```
`vercel.json`: o CSP ganhou `blob:` em `connect-src` (o GLTFLoader abre texturas embutidas do .glb por blob:).

## Como foi verificado (e o que NÃO foi)
Sem acesso à internet no ambiente de desenvolvimento: **não foi possível rodar `npm install`, `vite build`,
`tsc` completo nem os testes e2e**, e o `three` não existe lá, então o **Civic 3D nunca foi executado**.
Verificado: compilação sintática de todos os arquivos editados (esbuild), ausência de declarações não usadas
(regra `noUnusedLocals` do projeto), e renderização dos componentes reais (Layout, Painel, Login, site, documento)
com capturas de tela em desktop e celular. Rode `npm run typecheck`, `npm run build` e os testes antes de publicar.

## Achado fora do escopo (não alterado)
`DocShell` usa `photos = []` como padrão; um array novo a cada render faz o `useEffect` disparar em laço quando o
documento é aberto sem fotos (ex.: **Histórico de atendimento do veículo**). Correção de 1 linha (constante fora do
componente), mas é lógica, por isso aguarda autorização.
