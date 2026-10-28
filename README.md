# Cinebridge · Recommendation & Crew Orchestration Service

[![CI](https://github.com/tirolasca/Cinebridge/actions/workflows/ci.yml/badge.svg)](https://github.com/tirolasca/Cinebridge/actions/workflows/ci.yml)

Microsserviço responsável por recomendar e orquestrar a formação de equipes
técnicas para projetos audiovisuais na plataforma **Cinebridge**. Dado um
projeto — gênero, orçamento, prazo, papéis técnicos necessários — o serviço
consulta a base de profissionais cadastrados, aplica um algoritmo de
recomendação adequado ao tipo do projeto e devolve a equipe sugerida, com um
profissional para cada papel.

## Destaques

- **Recomendação inteligente e configurável** — três algoritmos prontos
  (similaridade técnica, reputação histórica, otimização de custo), aplicados
  conforme o tipo do projeto.
- **Tipos de projeto especializados** — documentário, animação e publicitário,
  cada um com seus próprios atributos, regras de validação, critério de
  recomendação e canal de notificação; novos tipos entram na plataforma sem
  alterar o núcleo do serviço.
- **Modelos de projeto prontos** — cada tipo tem um projeto-modelo que pode
  ser clonado para acelerar o cadastro de novos projetos.
- **Pacotes de serviços hierárquicos** — um projeto é descrito por uma árvore
  de serviços (pacotes dentro de pacotes), com custo e prazo calculados e
  validados em todos os níveis.
- **Integra com sistemas externos** — armazenamento de arquivos (S3, Google
  Cloud, local), pagamentos (Stripe, PagSeguro, PayPal) e cadastros de
  profissionais (base interna, LinkedIn, Indeed), trocáveis por configuração.
- **Recomendador extensível** — cache, auditoria e compressão podem ser
  combinados, na ordem que o produtor preferir, sobre qualquer recomendador.
- **Resiliente por padrão** — indisponibilidade parcial da base de
  profissionais não derruba o serviço: o motor devolve a melhor recomendação
  possível com os dados disponíveis.
- **Auditável de ponta a ponta** — toda recomendação gerada, convite aceito
  ou recusado, e equipe formada é registrada e notificada automaticamente.
- **Sobe em um comando** — ambiente completo (API + banco de dados +
  dados de exemplo) pronto via Docker, sem configuração manual.

## Como subir o ambiente

Pré-requisito: **Docker** e **Docker Compose**.

```bash
docker compose up --build
```

Ao final do comando a API está disponível em `http://localhost:3000`, com
banco de dados provisionado, uma base de profissionais de exemplo e um
projeto-modelo para cada tipo de projeto já carregados — pronta para testar
o endpoint de recomendação imediatamente.

Para derrubar o ambiente mantendo os dados:
```bash
docker compose down
```

Para derrubar e descartar os dados:
```bash
docker compose down -v
```

### Desenvolvimento local (API fora do container)

```bash
docker compose up -d db   # sobe apenas o banco de dados
npm install
npm run seed               # provisiona o schema e a base de exemplo
npm run dev                 # API com hot-reload em http://localhost:3000
```

Variáveis de ambiente e seus defaults estão documentadas em `.env.example`.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Healthcheck do serviço |
| `GET` | `/estrategias` | Lista as estratégias de recomendação disponíveis |
| `GET` | `/tipos-projeto` | Lista os tipos de projeto suportados |
| `POST` | `/projetos/recomendacao` | Recebe um projeto e retorna a equipe recomendada |
| `GET` | `/integracoes` | Provedores externos em uso e decoradores disponíveis |
| `GET` | `/recomendacao/diagnostico` | Estatísticas do cache, da auditoria e da compressão |
| `POST` | `/projetos/{projetoId}/arquivos` | Anexa um arquivo (conteúdo em base64) ao projeto |
| `GET` | `/projetos/{projetoId}/arquivos` | Lista os arquivos do projeto |
| `GET` | `/projetos/{projetoId}/arquivos/{nome}` | Baixa um arquivo do projeto (base64) |
| `POST` | `/pagamentos` | Efetua um pagamento entre produtor e profissional |
| `GET` | `/pagamentos/{id}` | Consulta a situação de um pagamento |
| `POST` | `/pagamentos/{id}/cancelamento` | Cancela um pagamento |
| `POST` | `/profissionais/{id}/avaliacoes` | Registra uma avaliação de profissional |

O campo obrigatório `tipoProjeto` (`DOCUMENTARIO`, `ANIMACAO` ou `PUBLICITARIO`)
define o tipo do projeto submetido e, com ele, as regras de validação, o
critério de recomendação e o notificador aplicados. Cada tipo também aceita
seus próprios campos (ver [Tipos de projeto](#tipos-de-projeto)); campos de
outros tipos são ignorados.

| Resposta | Quando |
|---|---|
| `201` | Equipe recomendada (`parcial: true` se algum papel ficou sem profissional) |
| `400` | Corpo inválido: campo obrigatório ausente ou `tipoProjeto` desconhecido |
| `422` | Projeto não atende às regras do seu tipo, ou tem orçamento zerado, prazo de entrega vencido, estrutura de serviços inválida ou nenhum papel requerido |

O trabalho a fazer é descrito por `servicoPrincipal` (a hierarquia de serviços,
ver [Pacotes de serviços](#pacotes-de-serviços)) ou, como atalho, por
`papeisRequeridos` (lista simples de papéis com pesos). Um dos dois é
obrigatório. A preferência `decoradores` (opcional) escolhe a pilha do
recomendador (ver [Decoradores do recomendador](#decoradores-do-recomendador)).

### Exemplo

```bash
curl -X POST http://localhost:3000/projetos/recomendacao \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Raízes do Sertão",
    "genero": "documentario",
    "duracaoEstimadaMinutos": 60,
    "orcamentoTotal": 50000,
    "dataEntrega": "2027-06-01T00:00:00.000Z",
    "tipoCaptacao": "DOCUMENTARIO",
    "localizacao": { "latitude": -23.55, "longitude": -46.63, "cidade": "São Paulo" },
    "papeisRequeridos": [
      { "papel": "DIRETOR", "pesoImportancia": 0.5 },
      { "papel": "EDITOR", "pesoImportancia": 0.5 }
    ],
    "produtorId": "produtor-123",
    "tipoProjeto": "DOCUMENTARIO",
    "tema": "Cultura popular nordestina",
    "entrevistados": ["Mestre Zé", "Dona Lia"]
  }'
```

```json
{
  "tipoProjeto": "DOCUMENTARIO",
  "itens": [
    { "papel": "DIRETOR", "profissionalId": "...", "nome": "Marina Alves" },
    { "papel": "EDITOR", "profissionalId": "...", "nome": "Camila Ferreira" }
  ],
  "parcial": false,
  "custoPlanejado": 50000,
  "prazoDias": 2,
  "decoradores": []
}
```

`custoPlanejado` e `prazoDias` vêm da hierarquia de serviços do projeto;
`decoradores` informa a pilha aplicada ao recomendador nessa solicitação.

## Estratégias de recomendação

O serviço decide qual profissional sugerir para cada papel de acordo com o
critério do tipo do projeto. Os três critérios disponíveis (listados em
`GET /estrategias`) são:

| Estratégia | Quando usar | Como decide |
|---|---|---|
| `similaridade_cosseno` | Projetos com requisitos técnicos bem definidos | Compara o vetor de competências do profissional com o perfil técnico ideal do papel |
| `filtragem_colaborativa` | Quando reputação e histórico pesam mais que competências declaradas | Nota média das avaliações recebidas + volume de experiência |
| `orcamento_reduzido` | Produções com restrição forte de orçamento | Prioriza o menor custo entre os profissionais que atendem a um piso de qualidade |

O mesmo conjunto de profissionais candidatos pode gerar recomendações
diferentes conforme o tipo do projeto: um documentário privilegia reputação,
uma animação privilegia competência técnica e um publicitário privilegia
custo. A tabela da seção seguinte mostra qual critério cada tipo utiliza.

## Tipos de projeto

Cada gênero de produção tem uma estrutura própria. O serviço trata cada tipo
como uma **família** de componentes que trabalham em conjunto: o projeto, o
validador, o recomendador e o notificador.

| Tipo | Atributos específicos | Validação | Recomendação |
|---|---|---|---|
| `DOCUMENTARIO` | tema, entrevistados | Exige tema e ao menos um entrevistado; roteirista precisa ter competências registradas | Prioriza reputação e histórico (filtragem colaborativa) |
| `ANIMACAO` | técnica de animação, software principal | Exige técnica e software definidos; especialista em VFX precisa de modelagem 3D ou motion graphics | Prioriza competências técnicas (similaridade de cosseno) |
| `PUBLICITARIO` | marca anunciante, data de veiculação | Exige marca e veiculação posterior à data de entrega | Prioriza custo-benefício (orçamento reduzido) |

Consulte os tipos disponíveis em `GET /tipos-projeto`.

### Modelos de projeto

Todo projeto pode ser **clonado** (`clonar()`), gerando uma cópia profunda
— papéis requeridos, localização e atributos específicos do tipo — que pode
ser ajustada sem afetar o original. Na carga inicial, o ambiente já inclui um
projeto-modelo de cada tipo (`Modelo · Documentário`, `Modelo · Animação` e
`Modelo · Publicitário`), prontos para servir de ponto de partida.

### Adicionando um novo tipo de projeto

Um novo tipo (por exemplo, realidade virtual) exige apenas:

1. a entidade do projeto, com seus atributos específicos;
2. uma fábrica que produza o validador, o recomendador e o notificador do tipo;
3. o registro dessa fábrica no seletor de fábricas.

Nenhuma alteração é necessária no orquestrador de equipes nem no sistema de
recomendação.

## Pacotes de serviços

Um projeto não é uma lista solta de papéis: é uma hierarquia de serviços. Um
**serviço atômico** tem nome, papel técnico, custo e prazo (em dias); um
**pacote** agrupa serviços atômicos e outros pacotes, em qualquer profundidade.
Custo, prazo e validação são calculados recursivamente, e um pacote é tratado
exatamente como um serviço individual.

```json
"servicoPrincipal": {
  "tipo": "PACOTE", "nome": "Documentário", "modoExecucao": "SEQUENCIAL",
  "servicos": [
    { "tipo": "PACOTE", "nome": "Pré-produção", "modoExecucao": "PARALELO",
      "servicos": [
        { "tipo": "ATOMICO", "nome": "Roteiro", "papel": "ROTEIRISTA", "custo": 6000,  "prazoDias": 15 },
        { "tipo": "ATOMICO", "nome": "Direção", "papel": "DIRETOR",    "custo": 12000, "prazoDias": 20 }
      ] },
    { "tipo": "PACOTE", "nome": "Pós-produção",
      "servicos": [
        { "tipo": "ATOMICO", "nome": "Edição",  "papel": "EDITOR",     "custo": 9000,  "prazoDias": 20 },
        { "tipo": "ATOMICO", "nome": "Mixagem", "papel": "SONOPLASTA", "custo": 5000,  "prazoDias": 8 }
      ] }
  ]
}
```

- **Custo:** a soma dos custos de todos os serviços (R$ 32.000 no exemplo).
- **Prazo:** em um pacote `SEQUENCIAL` (padrão), a soma dos prazos dos
  subserviços; em um `PARALELO`, o do subserviço mais demorado (48 dias no
  exemplo: 20 de pré-produção em paralelo + 28 de pós-produção em sequência).
- **Papéis:** os papéis recomendados são os das folhas da hierarquia, com
  peso proporcional ao custo planejado de cada papel.
- **Validação:** todos os serviços precisam ter nome, papel técnico existente,
  custo maior ou igual a zero e prazo inteiro de no mínimo 1 dia; pacotes não
  podem ser vazios nem conter a si mesmos; e o projeto precisa caber no
  orçamento e no prazo até a data de entrega. Os erros indicam o caminho até o
  serviço problemático (por exemplo, `Documentário › Pós-produção › Serviço
  "Edição": …`).

## Integrações externas

O serviço fala com sistemas de terceiros por adaptadores, que traduzem cada
provedor para um contrato único. Trocar de provedor é uma questão de
configuração: nenhuma regra de negócio muda, e os identificadores devolvidos
são os mesmos em qualquer provedor.

| Integração | Variável | Provedores (primeiro = padrão) |
|---|---|---|
| Armazenamento de arquivos de mídia | `ADAPTADOR_ARMAZENAMENTO` | `local`, `s3`, `google-cloud` |
| Pagamentos entre produtores e profissionais | `ADAPTADOR_PAGAMENTO` | `stripe`, `pagseguro`, `paypal` |
| Cadastro de profissionais candidatos | `ADAPTADOR_PROFISSIONAL` | `interno`, `linkedin`, `indeed` |

```bash
ADAPTADOR_ARMAZENAMENTO=s3 ADAPTADOR_PAGAMENTO=pagseguro ADAPTADOR_PROFISSIONAL=linkedin \
  docker compose up --build
```

Os provedores externos são **simulados** em memória, reproduzindo o formato
de cada API (por exemplo, o Stripe trabalha em centavos e com ids `pi_...`; o
PagSeguro, com valores em texto e situações em português). A situação de um
pagamento é sempre `PENDENTE`, `CONFIRMADO`, `CANCELADO` ou `FALHOU`, e
profissionais de redes externas chegam com ids prefixados (`linkedin:...`,
`indeed:...`). `GET /integracoes` mostra os provedores ativos.

## Decoradores do recomendador

O recomendador de cada tipo de projeto pode ser envolvido por camadas
independentes, combinadas em qualquer ordem:

| Decorador | O que faz |
|---|---|
| `cache` | Reaproveita o resultado de projetos similares (mesmo tipo, orçamento, papéis e candidatos). As entradas expiram em 5 minutos. |
| `auditoria` | Registra cada chamada: tipo de projeto, candidatos, membros recomendados, duração e sucesso ou erro. |
| `compressao` | Comprime (gzip) o resultado serializado, como seria transmitido a outros serviços, e registra a economia. |

A pilha é uma lista de nomes, do mais interno ao mais externo. Por exemplo,
`["cache", "auditoria", "compressao"]` aplica a compressão por fora da
auditoria, que por sua vez envolve o cache. A ordem importa: com a auditoria
por fora do cache ela vê todas as chamadas; com a auditoria por dentro, só as
que o cache não atendeu.

- **Padrão do serviço:** variável `RECOMENDACAO_DECORADORES` (padrão
  `cache,auditoria`; `none` desliga).
- **Por solicitação:** o campo `decoradores` do corpo da requisição, que
  substitui o padrão (uma lista vazia desliga todos).

`GET /recomendacao/diagnostico` mostra o desempenho do cache, os últimos
registros da auditoria e a taxa de compressão.

## Ciclo de vida da equipe

1. O produtor submete o projeto e recebe uma recomendação de equipe completa.
2. Para cada papel, pode **aceitar**, **recusar** ou **substituir** o
   profissional sugerido — uma recusa dispara automaticamente uma nova
   rodada de recomendação apenas para aquele papel, sem afetar os demais.
3. Mudanças relevantes de orçamento ou cronograma podem disparar uma
   **reavaliação completa** da equipe.
4. Ao final, a composição passa por validação de consistência (papéis
   obrigatórios preenchidos, orçamento respeitado) e, uma vez aprovada, é
   registrada e propagada para os demais microsserviços da plataforma
   (gerenciamento de projetos, financeiro).

Todo esse fluxo gera eventos consumidos de forma independente por
notificação por e-mail, mensageria interna da plataforma e log de auditoria.

## Arquitetura

O serviço segue arquitetura em camadas com inversão de dependência:

```
src/
  domain/          # Regras de negócio: entidades, tipos de projeto e suas
                    # fábricas, algoritmos de recomendação, eventos e
                    # operações sobre a composição de equipe
  application/      # Casos de uso: geração de recomendação, gestão de convites,
                    # orquestração do fluxo de composição, contratos (portas)
                    # dos sistemas externos
  infrastructure/   # Fastify (HTTP), PostgreSQL/TypeORM (persistência),
                    # adaptadores dos provedores externos, composição de
                    # dependências
```

- **Motor de recomendação configurável** — algoritmos de recomendação são
  encapsulados como componentes intercambiáveis, selecionados dinamicamente
  por projeto.
- **Fluxo de composição com etapas fixas** — validação de restrições,
  normalização de candidatos, ranqueamento e pós-processamento seguem sempre
  a mesma sequência, garantindo comportamento previsível e auditável
  independentemente das regras de negócio aplicadas em cada etapa.
- **Famílias de componentes por tipo de projeto** — o sistema de
  recomendação identifica o tipo do projeto, seleciona a fábrica
  correspondente e obtém dela todos os componentes necessários (validador,
  recomendador e notificador), de modo que o orquestrador de equipes nunca
  depende de um tipo específico de projeto.
- **Criação de projetos por clonagem** — projetos-modelo são duplicados com
  cópia profunda, sem que quem clona precise conhecer a classe concreta.
- **Hierarquias de serviços tratadas de modo uniforme** — serviços
  individuais e pacotes compartilham a mesma interface; custo, prazo e
  validação se propagam por toda a árvore sem que o projeto precise conhecer
  a sua forma.
- **Integrações isoladas por adaptadores** — armazenamento, pagamentos e
  cadastros de profissionais são acessados por contratos próprios da
  plataforma; cada provedor é traduzido por um adaptador na camada de
  infraestrutura, e o núcleo nunca depende de um provedor específico.
- **Comportamentos transversais por composição** — cache, auditoria e
  compressão envolvem o recomendador sem alterá-lo, e a pilha é montada em
  tempo de execução a partir de configuração ou da preferência do produtor.
- **Notificações desacopladas** — cada canal de notificação (e-mail,
  mensageria interna, auditoria) reage de forma independente aos eventos do
  domínio, sem se conhecerem entre si.
- **Operações transversais sem acoplar o domínio** — validação de
  consistência, cálculo de compatibilidade da equipe e geração de relatórios
  operam sobre a mesma estrutura de dados sem alterar as entidades de
  negócio.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24 LTS |
| Linguagem | TypeScript (modo estrito) |
| HTTP | Fastify |
| Persistência | PostgreSQL + TypeORM |
| Testes | Jest |
| Empacotamento | Docker / Docker Compose |

## Qualidade

```bash
npm test                  # suíte completa
npm run test:unit         # testes unitários
npm run test:integration  # testes de integração
npm run test:coverage     # relatório de cobertura
npm run test:smoke        # verifica a API em execução (ex.: após `docker compose up`)
```

Cobertura de testes mantida acima de 80% em statements, branches, functions
e lines. O fluxo completo — API, banco de dados e algoritmos de recomendação
— é validado tanto por testes automatizados quanto contra um banco de dados
real antes de cada entrega.

### Integração contínua

A cada push na `main` e a cada pull request, o workflow
[`ci.yml`](.github/workflows/ci.yml) executa:

- **Qualidade**, em Ubuntu 24.04 e Windows: checagem de tipos, build de
  produção e testes com limite mínimo de cobertura. O relatório de cobertura
  fica disponível como artefato da execução.
- **Docker Compose + smoke test**: sobe o ambiente completo (banco, schema,
  carga inicial e API) com `docker compose up --build` e valida os três tipos
  de projeto e as respostas de erro contra a API em execução.

## Requisitos operacionais

- Responde a solicitações de recomendação em menos de 2 segundos para uma
  base de até 10 mil profissionais ativos.
- Suporta no mínimo 100 requisições simultâneas.
- Tolerante a falhas em dependências externas: indisponibilidade parcial da
  base de profissionais resulta em recomendação parcial, não em erro.
- Todas as ações de produtores e profissionais são registradas para fins de
  auditoria.
- Compatível com Windows 10+, Linux Ubuntu 24.04+ e distribuições derivadas.
