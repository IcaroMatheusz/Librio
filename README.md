# Librio

Biblioteca digital para organizar e ler livros, quadrinhos e mangás. O Librio
tem uma aplicação web e uma versão desktop para Windows, construída com
Electron.

## Funcionalidades

- Cadastro, login e perfil de usuário.
- Biblioteca na nuvem para arquivos PDF, EPUB, CBR e CBZ.
- Leitura de PDFs, EPUBs e quadrinhos, com salvamento do progresso.
- Capas geradas a partir do arquivo ou selecionadas pelo usuário.
- Organização de PDFs em volumes.
- Autor opcional no envio e editável pelo menu de contexto do card na biblioteca.
- Aplicativo desktop com biblioteca local: os arquivos continuam nos locais
  originais do computador e não são enviados à nuvem.
- Capas e progresso de leitura das obras locais.
- Atualizações automáticas do desktop a partir das releases do GitHub.

## Tecnologias

- React, TypeScript, Vite e Tailwind CSS.
- Supabase Auth, Database e Storage.
- Electron e electron-builder.
- PDF.js, `@zip.js/zip.js` e `node-unrar-js`.

## Requisitos

- Node.js 24 e npm.
- Uma instância Supabase configurada para o Librio.
- Acesso ao repositório GitHub `IcaroMatheusz/Librio` para publicar releases.

## Configuração local

1. Clone o repositório e entre na pasta:

   ```powershell
   git clone https://github.com/IcaroMatheusz/Librio.git
   cd Librio
   ```

2. Instale as dependências:

   ```powershell
   npm ci
   ```

3. Crie um arquivo `.env` na raiz do projeto:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
   ```

   Use os valores do projeto Supabase. A chave `anon` é destinada ao cliente;
   nunca coloque uma chave `service_role` em variáveis `VITE_*` ou no código
   enviado ao navegador. O arquivo `.env` não deve ser commitado.

4. Configure no Supabase as tabelas, políticas de acesso (RLS) e buckets usados
   pelo projeto. O modelo TypeScript em [`src/types/database.ts`](./src/types/database.ts)
   descreve as tabelas esperadas, incluindo `profiles`, `books`,
   `reading_progress`, `local_reading_progress`, `user_storage`,
   `book_volumes`, `volume_chapters` e `volume_reading_progress`.
   O repositório não inclui scripts para criar esse schema ou as políticas;
   eles precisam ser provisionados no seu projeto Supabase.

5. Inicie a aplicação web:

   ```powershell
   npm run dev
   ```

   Para abrir a versão desktop em modo de desenvolvimento:

   ```powershell
   npm run electron:dev
   ```

### Supabase Storage

O projeto usa os buckets `books` e `coverarts`. O formulário aceita arquivos
de até 100 MB, portanto o limite do bucket `books` e o limite global de upload
do projeto Supabase também precisam permitir esse tamanho.

Configure os MIME types usados pelos arquivos:

| Formato | MIME type |
| --- | --- |
| PDF | `application/pdf` |
| EPUB | `application/epub+zip` |
| CBR | `application/vnd.comicbook-rar` |
| CBZ | `application/vnd.comicbook+zip` |

As capas são enviadas como JPEG ao bucket `coverarts`. Ajuste as políticas de
Storage e RLS para permitir que cada usuário acesse somente os próprios dados e
arquivos.

Na versão desktop, o catálogo local e as capas ficam no diretório de dados do
aplicativo. Os arquivos originais permanecem onde estavam quando foram
adicionados; remover uma obra local do Librio não apaga o arquivo original.

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento web. |
| `npm run build` | Executa a verificação TypeScript e cria o build web em `dist/`. |
| `npm run preview` | Serve localmente o build web. |
| `npm run lint` | Executa o ESLint. |
| `npm run electron:compile` | Compila os arquivos do processo principal e preload do Electron. |
| `npm run electron:dev` | Inicia a aplicação Electron apontando para o Vite. |
| `npm run electron:dist` | Cria os instaladores desktop para a plataforma atual. |

## Criar o instalador Windows localmente

Para testar ou gerar o `.exe` sem publicar uma release:

1. Atualize a versão do projeto. Use uma versão maior que a release anterior:

   ```powershell
   npm version 0.1.0 --no-git-tag-version
   ```

   Troque `0.1.0` pela versão que deseja gerar. Esse comando atualiza a versão
   em `package.json` e `package-lock.json`, sem criar uma tag Git.

2. Instale dependências e crie o instalador:

   ```powershell
   npm ci
   npm run electron:dist -- --win --publish never
   ```

3. Procure os arquivos gerados na pasta `release/`. O instalador terá um nome
   parecido com `Librio Setup 0.1.0.exe`. O electron-builder também pode gerar
   arquivos auxiliares, como `.blockmap` e `latest.yml`.

Esse build local **não publica** nada no GitHub. Para que a atualização
automática funcione, publique uma release contendo os metadados de atualização
e os artefatos correspondentes. O fluxo recomendado abaixo faz o build e a
publicação automaticamente.

## Publicar uma release no GitHub

Antes da primeira release, cadastre `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` em **Settings → Secrets and variables → Actions →
New repository secret**. O workflow usa esses valores no build desktop e
interrompe a publicação se algum estiver faltando.

O repositório já tem o workflow
[`desktop-release.yml`](./.github/workflows/desktop-release.yml). Ao receber
uma tag começando com `v`, ele compila o instalador Windows e o APK Android.
Depois que os dois builds terminam, o workflow publica todos os arquivos em
uma única release. O token `GITHUB_TOKEN` é fornecido pelo GitHub
Actions; não é necessário criar ou salvar um token pessoal.

Confirme também que o GitHub Actions está habilitado no repositório e que sua
conta tem permissão para enviar commits e tags. O workflow solicita a
permissão `contents: write` para publicar os artefatos.

### Primeira publicação

1. Faça e teste as alterações que devem entrar na release. Antes de publicar,
   rode:

   ```powershell
   npm run build
   npm run electron:compile
   npm run lint
   ```

2. Atualize a versão e grave essa alteração no branch principal. Exemplo para
   a primeira versão `0.1.0`:

   ```powershell
   npm version 0.1.0 --no-git-tag-version
   git add package.json package-lock.json
   git commit -m "chore: prepare release v0.1.0"
   ```

   Se ainda houver outras alterações a publicar, inclua-as nos commits antes
   de criar a tag.

3. Envie o branch e crie/envie a tag que dispara o workflow:

   ```powershell
   git push origin main
   git tag -a v0.1.0 -m "Librio v0.1.0"
   git push origin v0.1.0
   ```

   A tag deve apontar para o commit que contém o código e a versão dessa
   release. Substitua `main` se o branch principal do repositório tiver outro
   nome.

4. No GitHub, abra **Actions** e acompanhe **Publish desktop and Android
   releases**. Quando terminar, confira a release em
   <https://github.com/IcaroMatheusz/Librio/releases>.

5. A release inclui o instalador `Librio-Setup-0.1.0.exe`, o
   `Librio-Android.apk` e os arquivos de atualização, como `latest.yml` e o
   `.blockmap`. Não remova esses arquivos: o `electron-updater` precisa dos
   metadados para encontrar e baixar as versões seguintes.

Se o workflow falhar, abra a execução em **Actions**, localize o primeiro passo
com erro, corrija-o e publique uma nova versão com uma nova tag. Tags já
publicadas não devem ser reutilizadas para conteúdo diferente.

### Publicar versões seguintes

Repita os passos acima usando uma versão maior, por exemplo `0.1.1` ou `0.2.0`,
e uma nova tag (`v0.1.1` ou `v0.2.0`). Evite sobrescrever ou reutilizar tags de
releases existentes.

### Disponibilizar o download no site

A página de downloads consulta a release mais recente no GitHub. Quando
encontra um instalador Windows `.exe` com `Setup` no nome, exibe um botão para
baixá-lo. Se ainda não houver uma release publicada, a página direciona para
a área de releases do GitHub.

## Atualizações automáticas

Versões instaladas pelo instalador publicado verificam novas releases quando o
Librio Desktop inicia. Quando uma atualização está disponível, ela é baixada
em segundo plano e o aplicativo oferece reiniciar para instalá-la. Fechar o
aviso instala a atualização na próxima vez que o aplicativo for encerrado.

As atualizações não são executadas em modo de desenvolvimento. Distribua o
instalador criado e publicado pelo fluxo de release; executar o aplicativo
diretamente do código-fonte não instala atualizações.

O workflow atual publica o instalador **Windows**. Embora o electron-builder
tenha configuração para macOS e Linux, essas plataformas ainda não são
compiladas por esse workflow.

## Aplicativo móvel (React Native)

O projeto React Native fica em `mobile/`, separado do frontend web e do
Electron. Ele usa Expo, Expo Router e a mesma instância Supabase. Para iniciar:

```powershell
cd mobile
npm install
Copy-Item .env.example .env
```

Preencha `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no
arquivo `mobile/.env` e inicie com `npm run start`. Use a chave pública `anon`;
nunca configure `service_role` no aplicativo. Na configuração de autenticação
do Supabase, adicione `librio://reset-password` à lista de URLs de
redirecionamento permitidas para a recuperação de senha.

O aplicativo usa a identidade visual do Librio, com tema escuro, detalhes
violeta, transições animadas e artes em `src/assets/mobile`. Inclui cadastro,
login, recuperação de senha, sessão persistente, perfil (nome, e-mail, senha e
foto), logout, indicador da cota cloud, envio e busca de obras, edição de título
e autor, exclusão, histórico de progresso sincronizado, montagem de volumes e
catálogo local. No Android, uma pasta pode ser analisada pelo seletor de
diretório; no iOS, arquivos são escolhidos individualmente. Os PDFs cloud abrem
no visualizador embutido. EPUBs e quadrinhos cloud são baixados e abertos em um
leitor compatível instalado no aparelho; as posições de leitura detalhadas e o
leitor interno desses formatos ainda precisam de um port nativo.

### Wallpapers do aplicativo móvel

Edite o objeto `wallpapers` em `mobile/src/config/wallpapers.ts`. As chaves
`library`, `profile`, `volumes`, `login`, `register` e `recovery` correspondem
à estante, edição de perfil, volumes, login, cadastro e redefinição de senha.
Escolha uma chave de `wallpaperAssets` para cada tela. Para usar outra imagem,
salve-a em `mobile/assets` e adicione seu `require(...)` a `wallpaperAssets`.

| Chave | Arquivo | Dimensões da imagem original |
| --- | --- | --- |
| `nightwing` | `mobile/assets/nightwing_wallpaper.jpg` | 1170 × 2532 px |
| `daredevil` | `mobile/assets/daredevil_wallpaper.jpg` | 1080 × 2160 px |
| `fullmetal` | `mobile/assets/fullmetal_wallpaper.jpg` | 1200 × 1814 px |
| `bleach` | `mobile/assets/bleach_wallpaper.jpg` | 818 × 1150 px |
| `onePiece` | `src/assets/mobile/onepiece_wallpaper.jpg` | 568 × 1200 px |
| `hellboy` | `src/assets/mobile/hellboy_wallpaper.jpg` | 1080 × 1434 px |
| `spawnReading` | `mobile/assets/spawn-reading.webp` | 520 × 688 px |

#### Gabaritos dos banners

As medidas dos cards abaixo estão em pontos lógicos (`dp`), com a largura
disponível já descontando eventuais áreas seguras laterais. As alturas são
mínimas e podem crescer quando o texto ocupa mais espaço.

| Largura disponível | Estante | Volumes | Edição de perfil |
| --- | --- | --- | --- |
| Celular de 360 dp | 324 × 148 dp | 324 × 212 dp | 324 × 255 dp |
| Celular de 390 dp | 354 × 148 dp | 354 × 212 dp | 354 × 255 dp |
| Celular de 412 dp | 376 × 148 dp | 376 × 212 dp | 376 × 255 dp |
| Tablet de 820 dp | 764 × 176 dp | 764 × 255 dp | 764 × 255 dp |
| Tablet de 1120 dp ou mais | 1064 × 176 dp | 1064 × 255 dp | 1064 × 255 dp |

Para compor a arte com base em um celular de 390 dp, exporte em 3×.
Use **1062 × 444 px** para a estante, **1062 × 636 px** para os volumes e
**1062 × 765 px** para o perfil. Na estante, deixe o assunto principal à
direita e reserve o lado esquerdo para o título. O componente
[`LibraryMasthead`](./mobile/src/components/LibraryBooks.tsx) posiciona a arte
transparente de Spawn à direita. Ao escolher um wallpaper retangular, ele
preenche todo o card com recorte central.

O componente [`WallpaperHero`](./mobile/src/components/WallpaperHero.tsx)
define as alturas de volumes e perfil. Posicione os elementos importantes
acima da faixa inferior de texto. O parâmetro `focalPoint` move o recorte
vertical do topo (`0`) ao rodapé (`1`). Volumes usa `0.66` e o perfil usa `0.75`.

Login, cadastro e redefinição de senha exibem a arte num banner com **136 dp**
de altura. Em um celular de 390 dp, o card mede **354 × 136 dp** (exportação a
3× de **1062 × 408 px**). Em tablets, o card chega a **480 × 136 dp**. Deixe
espaço à esquerda para a marca e concentre o assunto principal à direita.
O formulário usa o tema selecionado em **Preferências de leitura → Aparência do aplicativo**.

### Publicação das versões

As versões desktop e Android são compiladas pelo workflow
[`desktop-release.yml`](./.github/workflows/desktop-release.yml) ao enviar uma
tag `v*`. O APK é anexado à mesma release do GitHub. A página `/download`
consulta o APK da release mais recente e exibe o botão **Baixar APK** quando o
artefato está disponível. O workflow reutiliza os secrets
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para configurar o build mobile.
