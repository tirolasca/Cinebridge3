import { Profissional } from '../../src/domain/entities/Profissional';
import { Projeto, DadosProjeto } from '../../src/domain/entities/Projeto';
import { ProjetoDocumentario } from '../../src/domain/entities/ProjetoDocumentario';
import { Competencia } from '../../src/domain/entities/Competencia';
import { Avaliacao } from '../../src/domain/entities/Avaliacao';
import { PapelTecnico, TipoCaptacao } from '../../src/domain/entities/types';

let contador = 0;
function proximoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${contador}`;
}

export function criarProfissional(parcial?: Partial<Profissional>): Profissional {
  const profissional = new Profissional({
    id: proximoId('prof'),
    nome: `Profissional ${contador}`,
    especialidadePrincipal: PapelTecnico.EDITOR,
    faixaDePreco: { minimo: 1000, maximo: 5000 },
    disponibilidade: [{ inicio: new Date('2026-01-01'), fim: new Date('2026-12-31') }],
    localizacao: { latitude: -23.55, longitude: -46.63, cidade: 'São Paulo' },
    historicoProjetos: [],
    competencias: [],
    avaliacoes: [],
    ...parcial
  });
  return profissional;
}

export function criarCompetencia(nome: string, nivel: number): Competencia {
  return new Competencia(nome, nivel);
}

export function criarAvaliacao(nota: number, projetoId = proximoId('proj-anterior')): Avaliacao {
  return new Avaliacao(nota, projetoId);
}

/**
 * Builder padrão de testes: usa ProjetoDocumentario como implementação
 * concreta de referência, já que a maior parte dos testes de domínio
 * (Strategy, Template Method, Observer, Visitor) é agnóstica ao tipo
 * concreto de projeto. Testes que exercitam especificamente o Prototype
 * ou a Abstract Factory instanciam as subclasses diretamente.
 */
export function criarProjeto(parcial?: DadosProjeto<Projeto>): Projeto {
  return new ProjetoDocumentario({
    id: proximoId('projeto'),
    titulo: 'Curta-metragem de teste',
    genero: 'drama',
    duracaoEstimadaMinutos: 20,
    orcamentoTotal: 50000,
    dataEntrega: dataFutura(365),
    tipoCaptacao: TipoCaptacao.FICCAO,
    localizacao: { latitude: -23.55, longitude: -46.63, cidade: 'São Paulo' },
    papeisRequeridos: [
      { papel: PapelTecnico.DIRETOR, pesoImportancia: 0.4 },
      { papel: PapelTecnico.EDITOR, pesoImportancia: 0.3 },
      { papel: PapelTecnico.SONOPLASTA, pesoImportancia: 0.3 }
    ],
    produtorId: proximoId('produtor'),
    estrategiaRecomendacao: 'similaridade_cosseno',
    ...parcial
  });
}

/** Data relativa a hoje, para que os testes não envelheçam com o calendário. */
export function dataFutura(dias = 365): Date {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
}
