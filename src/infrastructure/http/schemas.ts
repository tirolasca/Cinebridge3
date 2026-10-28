/**
 * Hierarquia de serviços (Composite) no corpo da requisição: um serviço é
 * atômico (`ATOMICO`: papel, custo e prazo) ou um pacote (`PACOTE`) com uma
 * lista de serviços, que por sua vez podem ser atômicos ou pacotes. A forma
 * é verificada aqui; as regras de negócio (papel existente, custo, prazo)
 * são validadas pelo domínio.
 */
const definicaoDeServico = {
  type: 'object',
  required: ['tipo', 'nome'],
  properties: {
    tipo: { type: 'string', enum: ['ATOMICO', 'PACOTE'] },
    nome: { type: 'string' },
    papel: { type: 'string' },
    custo: { type: 'number' },
    prazoDias: { type: 'number' },
    modoExecucao: { type: 'string', enum: ['SEQUENCIAL', 'PARALELO'] },
    servicos: { type: 'array', items: { $ref: '#/definitions/servico' } }
  }
} as const;

/**
 * Schema JSON Schema usado pelo Fastify para validar o corpo da requisição
 * de recomendação, aproveitando o suporte nativo do framework a esquemas de
 * validação. O projeto descreve o trabalho a fazer por `servicoPrincipal`
 * (hierarquia de serviços) ou, como atalho, por `papeisRequeridos`.
 */
export const schemaProjetoRequisicao = {
  type: 'object',
  definitions: { servico: definicaoDeServico },
  required: [
    'titulo',
    'genero',
    'duracaoEstimadaMinutos',
    'orcamentoTotal',
    'dataEntrega',
    'tipoCaptacao',
    'localizacao',
    'produtorId',
    'tipoProjeto'
  ],
  anyOf: [{ required: ['servicoPrincipal'] }, { required: ['papeisRequeridos'] }],
  properties: {
    titulo: { type: 'string', minLength: 1 },
    genero: { type: 'string', minLength: 1 },
    duracaoEstimadaMinutos: { type: 'integer', minimum: 1 },
    orcamentoTotal: { type: 'number', exclusiveMinimum: 0 },
    dataEntrega: { type: 'string', format: 'date-time' },
    tipoCaptacao: { type: 'string', enum: ['DOCUMENTARIO', 'FICCAO', 'ANIMACAO'] },
    localizacao: {
      type: 'object',
      required: ['latitude', 'longitude', 'cidade'],
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        cidade: { type: 'string' }
      }
    },
    servicoPrincipal: { $ref: '#/definitions/servico' },
    papeisRequeridos: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['papel', 'pesoImportancia'],
        properties: {
          papel: {
            type: 'string',
            enum: ['DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA', 'EDITOR', 'ROTEIRISTA', 'ESPECIALISTA_VFX']
          },
          pesoImportancia: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    produtorId: { type: 'string', minLength: 1 },
    tipoProjeto: { type: 'string', enum: ['DOCUMENTARIO', 'ANIMACAO', 'PUBLICITARIO'] },
    // Preferência do produtor: pilha de decoradores do recomendador (do mais interno ao mais externo).
    decoradores: { type: 'array', items: { type: 'string' } },
    // Campos específicos por tipo de projeto (cada tipo lê apenas os seus)
    tema: { type: 'string' },
    entrevistados: { type: 'array', items: { type: 'string' } },
    tecnicaAnimacao: { type: 'string' },
    softwarePrincipal: { type: 'string' },
    marcaAnunciante: { type: 'string' },
    dataVeiculacao: { type: 'string', format: 'date-time' }
  }
} as const;

export const schemaArquivoRequisicao = {
  type: 'object',
  required: ['nome', 'conteudoBase64'],
  properties: {
    nome: { type: 'string', minLength: 1 },
    conteudoBase64: { type: 'string', minLength: 1 },
    tipoConteudo: { type: 'string' }
  }
} as const;

export const schemaPagamentoRequisicao = {
  type: 'object',
  required: ['valor', 'origem', 'destino'],
  properties: {
    valor: { type: 'number', exclusiveMinimum: 0 },
    origem: { type: 'string', minLength: 1 },
    destino: { type: 'string', minLength: 1 }
  }
} as const;

export const schemaAvaliacaoRequisicao = {
  type: 'object',
  required: ['nota', 'projetoId'],
  properties: {
    nota: { type: 'number', minimum: 0, maximum: 5 },
    projetoId: { type: 'string', minLength: 1 },
    comentario: { type: 'string' }
  }
} as const;
