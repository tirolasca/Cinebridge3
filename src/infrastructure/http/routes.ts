import { FastifyInstance, FastifyReply } from 'fastify';
import { Container } from './container';
import { Projeto } from '../../domain/entities/Projeto';
import { TipoProjeto } from '../../domain/entities/types';
import { DadosCriacaoProjeto } from '../../domain/factories/DadosCriacaoProjeto';
import { ServicoInvalidoError, desserializarServico } from '../../domain/servicos/ServicoJson';
import { PilhaDeDecoradoresInvalidaError } from '../../domain/recomendacao/ConstrutorDePilhaDeRecomendacao';
import {
  ArgumentoInvalidoError,
  ArquivoNaoEncontradoError,
  AvaliacaoInvalidaError,
  ErroDeIntegracao,
  PagamentoInvalidoError,
  PagamentoNaoEncontradoError,
  PagamentoRecusadoError,
  ProfissionalNaoEncontradoError
} from '../../application/ports/ErrosDeIntegracao';
import {
  schemaArquivoRequisicao,
  schemaAvaliacaoRequisicao,
  schemaPagamentoRequisicao,
  schemaProjetoRequisicao
} from './schemas';

interface CorpoProjetoRequisicao {
  titulo: string;
  genero: string;
  duracaoEstimadaMinutos: number;
  orcamentoTotal: number;
  dataEntrega: string;
  tipoCaptacao: 'DOCUMENTARIO' | 'FICCAO' | 'ANIMACAO';
  localizacao: { latitude: number; longitude: number; cidade: string };
  servicoPrincipal?: unknown;
  papeisRequeridos?: Array<{ papel: string; pesoImportancia: number }>;
  produtorId: string;
  tipoProjeto: 'DOCUMENTARIO' | 'ANIMACAO' | 'PUBLICITARIO';
  decoradores?: string[];
  tema?: string;
  entrevistados?: string[];
  tecnicaAnimacao?: string;
  softwarePrincipal?: string;
  marcaAnunciante?: string;
  dataVeiculacao?: string;
}

/** Converte os erros conhecidos do sistema no código HTTP correspondente. */
function responderErro(reply: FastifyReply, erro: unknown, padrao: { codigo: number; titulo: string }) {
  const detalhe = erro instanceof Error ? erro.message : 'Erro desconhecido';
  const resposta = (codigo: number, titulo: string) => reply.code(codigo).send({ erro: titulo, detalhe });

  if (erro instanceof ArquivoNaoEncontradoError || erro instanceof PagamentoNaoEncontradoError || erro instanceof ProfissionalNaoEncontradoError) {
    return resposta(404, 'Não encontrado');
  }
  if (erro instanceof ArgumentoInvalidoError || erro instanceof PagamentoInvalidoError || erro instanceof AvaliacaoInvalidaError || erro instanceof PilhaDeDecoradoresInvalidaError) {
    return resposta(400, 'Requisição inválida');
  }
  if (erro instanceof PagamentoRecusadoError) return resposta(402, 'Pagamento recusado');
  if (erro instanceof ErroDeIntegracao) return resposta(502, 'Falha no serviço externo');
  if (erro instanceof ServicoInvalidoError) return resposta(422, 'Hierarquia de serviços inválida');
  return resposta(padrao.codigo, padrao.titulo);
}

/**
 * Registra as rotas REST do microsserviço de recomendação e orquestração
 * de equipes.
 *
 * - POST /projetos/recomendacao: recebe um projeto de qualquer tipo suportado
 *   e devolve a equipe recomendada pela família de componentes do tipo.
 * - Arquivos, pagamentos e avaliações passam pelos adaptadores configurados
 *   (ADAPTADOR_ARMAZENAMENTO, ADAPTADOR_PAGAMENTO, ADAPTADOR_PROFISSIONAL).
 */
export async function registrarRotas(app: FastifyInstance, container: Container): Promise<void> {
  const sistema = container.sistemaRecomendacao;

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/estrategias', async () => ({
    disponiveis: container.estrategiaFactory.listarNomesDisponiveis()
  }));

  app.get('/tipos-projeto', async () => ({
    disponiveis: container.seletorDeFabrica.tiposDisponiveis()
  }));

  // ------------------------------------------------------------------ diagnóstico

  app.get('/integracoes', async () => ({
    provedores: sistema.provedoresAtivos(),
    decoradores: { disponiveis: sistema.decoradoresDisponiveis(), padrao: sistema.pilhaPadrao() }
  }));

  app.get('/recomendacao/diagnostico', async () => ({
    pilhaPadrao: sistema.pilhaPadrao(),
    decoradoresDisponiveis: sistema.decoradoresDisponiveis(),
    cache: container.cacheDeRecomendacao.estatisticas(),
    auditoria: {
      total: container.auditoriaDeRecomendacao.total(),
      ultimos: container.auditoriaDeRecomendacao.ultimos(10)
    },
    compressao: container.compressaoDeRecomendacao.resumo()
  }));

  // ------------------------------------------------------------------ recomendação

  app.post<{ Body: CorpoProjetoRequisicao }>(
    '/projetos/recomendacao',
    { schema: { body: schemaProjetoRequisicao } },
    async (request, reply) => {
      const corpo = request.body;

      try {
        const dados: DadosCriacaoProjeto = {
          titulo: corpo.titulo,
          genero: corpo.genero,
          duracaoEstimadaMinutos: corpo.duracaoEstimadaMinutos,
          orcamentoTotal: corpo.orcamentoTotal,
          dataEntrega: new Date(corpo.dataEntrega),
          tipoCaptacao: corpo.tipoCaptacao as Projeto['tipoCaptacao'],
          localizacao: corpo.localizacao,
          produtorId: corpo.produtorId,
          // Hierarquia de serviços (Composite) ou, como atalho, a lista de papéis.
          servicoPrincipal: corpo.servicoPrincipal ? desserializarServico(corpo.servicoPrincipal) : undefined,
          papeisRequeridos: corpo.papeisRequeridos as Projeto['papeisRequeridos'] | undefined,
          // Campos específicos: cada fábrica lê apenas os do seu tipo.
          tema: corpo.tema,
          entrevistados: corpo.entrevistados,
          tecnicaAnimacao: corpo.tecnicaAnimacao,
          softwarePrincipal: corpo.softwarePrincipal,
          marcaAnunciante: corpo.marcaAnunciante,
          dataVeiculacao: corpo.dataVeiculacao ? new Date(corpo.dataVeiculacao) : undefined
        };

        // Factory Method: a fábrica concreta correspondente ao tipo de projeto
        // informado é quem sabe instanciar a subclasse correta de Projeto —
        // esta rota nunca decide diretamente qual classe concreta construir.
        const fabrica = container.seletorDeFabrica.obterFabrica(corpo.tipoProjeto as TipoProjeto);
        const projeto = fabrica.criarProjeto(dados);

        const recomendacao = await sistema.gerarRecomendacao(projeto, { decoradores: corpo.decoradores });
        return reply.code(201).send(recomendacao);
      } catch (erro) {
        request.log.error(erro);
        return responderErro(reply, erro, { codigo: 422, titulo: 'Não foi possível gerar a recomendação' });
      }
    }
  );

  // ------------------------------------------------------------------ armazenamento

  app.post<{ Params: { projetoId: string }; Body: { nome: string; conteudoBase64: string; tipoConteudo?: string } }>(
    '/projetos/:projetoId/arquivos',
    { schema: { body: schemaArquivoRequisicao } },
    async (request, reply) => {
      try {
        const { nome, conteudoBase64, tipoConteudo } = request.body;
        const id = await sistema.anexarArquivo(request.params.projetoId, nome, Buffer.from(conteudoBase64, 'base64'), tipoConteudo);
        return reply.code(201).send({ id, provedor: sistema.provedoresAtivos().armazenamento });
      } catch (erro) {
        return responderErro(reply, erro, { codigo: 500, titulo: 'Erro ao anexar o arquivo' });
      }
    }
  );

  app.get<{ Params: { projetoId: string } }>('/projetos/:projetoId/arquivos', async (request, reply) => {
    try {
      return { arquivos: await sistema.listarArquivos(request.params.projetoId) };
    } catch (erro) {
      return responderErro(reply, erro, { codigo: 500, titulo: 'Erro ao listar os arquivos' });
    }
  });

  app.get<{ Params: { projetoId: string; nome: string } }>('/projetos/:projetoId/arquivos/:nome', async (request, reply) => {
    try {
      const id = `projetos/${request.params.projetoId}/${request.params.nome}`;
      const conteudo = await sistema.recuperarArquivo(id);
      return { id, tamanho: conteudo.length, conteudoBase64: conteudo.toString('base64') };
    } catch (erro) {
      return responderErro(reply, erro, { codigo: 500, titulo: 'Erro ao recuperar o arquivo' });
    }
  });

  // ------------------------------------------------------------------ pagamentos

  app.post<{ Body: { valor: number; origem: string; destino: string } }>(
    '/pagamentos',
    { schema: { body: schemaPagamentoRequisicao } },
    async (request, reply) => {
      try {
        const { valor, origem, destino } = request.body;
        const id = await sistema.efetuarPagamento(valor, origem, destino);
        return reply.code(201).send({ id, status: await sistema.consultarPagamento(id), provedor: sistema.provedoresAtivos().pagamento });
      } catch (erro) {
        return responderErro(reply, erro, { codigo: 500, titulo: 'Erro ao efetuar o pagamento' });
      }
    }
  );

  app.get<{ Params: { id: string } }>('/pagamentos/:id', async (request, reply) => {
    try {
      return { id: request.params.id, status: await sistema.consultarPagamento(request.params.id) };
    } catch (erro) {
      return responderErro(reply, erro, { codigo: 500, titulo: 'Erro ao consultar o pagamento' });
    }
  });

  app.post<{ Params: { id: string } }>('/pagamentos/:id/cancelamento', async (request, reply) => {
    try {
      const cancelado = await sistema.cancelarPagamento(request.params.id);
      return { id: request.params.id, cancelado, status: await sistema.consultarPagamento(request.params.id) };
    } catch (erro) {
      return responderErro(reply, erro, { codigo: 500, titulo: 'Erro ao cancelar o pagamento' });
    }
  });

  // ------------------------------------------------------------------ avaliações

  app.post<{ Params: { id: string }; Body: { nota: number; projetoId: string; comentario?: string } }>(
    '/profissionais/:id/avaliacoes',
    { schema: { body: schemaAvaliacaoRequisicao } },
    async (request, reply) => {
      try {
        await sistema.registrarAvaliacao(request.params.id, request.body);
        return reply.code(204).send();
      } catch (erro) {
        return responderErro(reply, erro, { codigo: 500, titulo: 'Erro ao registrar a avaliação' });
      }
    }
  );
}
