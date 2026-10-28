import { DataSource } from 'typeorm';
import { EstrategiaRecomendacaoFactory } from '../../domain/strategies/EstrategiaRecomendacaoFactory';
import { OrquestradorPadrao } from '../../application/orchestrator/OrquestradorPadrao';
import { OrquestradorReavaliacao } from '../../application/orchestrator/OrquestradorReavaliacao';
import { SujeitoDeEventos } from '../../domain/events/Observer';
import { ObservadorEmail } from '../../domain/events/observadores/ObservadorEmail';
import { ObservadorMensagemInterna } from '../../domain/events/observadores/ObservadorMensagemInterna';
import { ObservadorAuditoria } from '../../domain/events/observadores/ObservadorAuditoria';
import { MotorDeRecomendacao } from '../../application/services/MotorDeRecomendacao';
import { ServicoDeConvites } from '../../application/services/ServicoDeConvites';
import { SistemaRecomendacao } from '../../application/services/SistemaRecomendacao';
import { RepositorioProfissionais } from '../../application/services/RepositorioProfissionais';
import { RepositorioProfissionaisTypeOrm } from '../persistence/RepositorioProfissionaisTypeOrm';
import { SeletorDeFabricaProjeto } from '../../domain/factories/SeletorDeFabricaProjeto';
import { ArmazenamentoDeCache } from '../../domain/recomendacao/CacheDecorator';
import { AuditoriaEmMemoria } from '../../domain/recomendacao/AuditoriaDecorator';
import { EstatisticasDeCompressao } from '../../domain/recomendacao/CompressaoDecorator';
import { criarConstrutorPadrao } from '../../domain/recomendacao/ConstrutorDePilhaDeRecomendacao';
import { criarAdaptadores, lerConfiguracaoDeIntegracoes } from '../integracao/AdaptadoresFactory';

export interface Container {
  readonly sujeitoDeEventos: SujeitoDeEventos;
  readonly repositorioProfissionais: RepositorioProfissionais;
  readonly estrategiaFactory: EstrategiaRecomendacaoFactory;
  readonly motorDeRecomendacao: MotorDeRecomendacao;
  readonly motorDeReavaliacao: MotorDeRecomendacao;
  readonly servicoDeConvites: ServicoDeConvites;
  readonly seletorDeFabrica: SeletorDeFabricaProjeto;
  readonly sistemaRecomendacao: SistemaRecomendacao;
  /** Estado compartilhado pelos decoradores do recomendador (para diagnóstico). */
  readonly cacheDeRecomendacao: ArmazenamentoDeCache;
  readonly auditoriaDeRecomendacao: AuditoriaEmMemoria;
  readonly compressaoDeRecomendacao: EstatisticasDeCompressao;
}

/**
 * Pilha de decoradores usada quando a solicitação não escolhe uma, lida de
 * RECOMENDACAO_DECORADORES (nomes separados por vírgula, do mais interno ao
 * mais externo). Padrão: "cache,auditoria". Use "none" para desligar.
 */
export function lerPilhaPadrao(env: NodeJS.ProcessEnv = process.env): string[] {
  const valor = env.RECOMENDACAO_DECORADORES ?? 'cache,auditoria';
  if (valor.trim().toLowerCase() === 'none') return [];
  return valor
    .split(',')
    .map((nome) => nome.trim())
    .filter((nome) => nome.length > 0);
}

/**
 * Composição de dependências explícita (sem framework de DI), montando o
 * grafo de objetos da aplicação a partir da fonte de dados fornecida.
 * Mantém o ponto de injeção de dependências centralizado e testável.
 * Retorna o tipo Container (baseado na interface RepositorioProfissionais),
 * permitindo que testes substituam a implementação concreta por um dublê.
 */
export function montarContainer(dataSource: DataSource, env: NodeJS.ProcessEnv = process.env): Container {
  const sujeitoDeEventos = new SujeitoDeEventos();
  sujeitoDeEventos.inscrever(
    new ObservadorEmail(async (destinatario, assunto, corpo) => {
      // eslint-disable-next-line no-console
      console.log(`[email] Para: ${destinatario} | Assunto: ${assunto} | ${corpo}`);
    })
  );
  sujeitoDeEventos.inscrever(new ObservadorMensagemInterna());
  sujeitoDeEventos.inscrever(new ObservadorAuditoria());

  const repositorioProfissionais = new RepositorioProfissionaisTypeOrm(dataSource);
  const estrategiaFactory = new EstrategiaRecomendacaoFactory();
  const orquestradorPadrao = new OrquestradorPadrao();
  const orquestradorReavaliacao = new OrquestradorReavaliacao();

  const motorDeRecomendacao = new MotorDeRecomendacao(
    estrategiaFactory,
    orquestradorPadrao,
    repositorioProfissionais,
    sujeitoDeEventos
  );

  const motorDeReavaliacao = new MotorDeRecomendacao(
    estrategiaFactory,
    orquestradorReavaliacao,
    repositorioProfissionais,
    sujeitoDeEventos
  );

  const servicoDeConvites = new ServicoDeConvites(sujeitoDeEventos);
  const seletorDeFabrica = new SeletorDeFabricaProjeto();

  // Cache, auditoria e compressão: estado compartilhado entre as requisições.
  const cacheDeRecomendacao = new ArmazenamentoDeCache();
  const auditoriaDeRecomendacao = new AuditoriaEmMemoria(1000, (registro) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ evento: 'recomendacao', ...registro }));
  });
  const compressaoDeRecomendacao = new EstatisticasDeCompressao();
  const construtorDePilha = criarConstrutorPadrao({
    cache: cacheDeRecomendacao,
    auditoria: auditoriaDeRecomendacao,
    compressao: compressaoDeRecomendacao
  });
  const pilhaPadrao = lerPilhaPadrao(env);
  construtorDePilha.validar(pilhaPadrao); // falha já na inicialização se a configuração estiver errada

  // Provedores externos escolhidos por configuração (ADAPTADOR_*).
  const adaptadores = criarAdaptadores(lerConfiguracaoDeIntegracoes(env), { repositorioProfissionais });

  const sistemaRecomendacao = new SistemaRecomendacao(seletorDeFabrica, sujeitoDeEventos, adaptadores, {
    construtor: construtorDePilha,
    padrao: pilhaPadrao
  });

  return {
    sujeitoDeEventos,
    repositorioProfissionais,
    estrategiaFactory,
    motorDeRecomendacao,
    motorDeReavaliacao,
    servicoDeConvites,
    seletorDeFabrica,
    sistemaRecomendacao,
    cacheDeRecomendacao,
    auditoriaDeRecomendacao,
    compressaoDeRecomendacao
  };
}
