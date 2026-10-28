import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Profissional } from '../../domain/entities/Profissional';
import { Competencia } from '../../domain/entities/Competencia';
import { Avaliacao } from '../../domain/entities/Avaliacao';
import { Projeto } from '../../domain/entities/Projeto';
import { ProjetoDocumentario } from '../../domain/entities/ProjetoDocumentario';
import { ProjetoAnimacao } from '../../domain/entities/ProjetoAnimacao';
import { ProjetoPublicitario } from '../../domain/entities/ProjetoPublicitario';
import { PapelTecnico, TipoCaptacao } from '../../domain/entities/types';
import { PacoteServico } from '../../domain/servicos/PacoteServico';
import { ServicoAtomico } from '../../domain/servicos/ServicoAtomico';
import { ModoExecucao } from '../../domain/servicos/ServicoProjeto';

/** Data daqui a `dias` dias, para que os modelos não nasçam com a entrega vencida. */
const emDias = (dias: number): Date => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

/**
 * Cadastra um projeto-modelo para cada tipo de projeto suportado
 * (documentário, animação e publicitário). Os modelos servem de protótipo
 * inicial: novos projetos podem ser criados a partir deles por clonagem
 * (`clonar()`), ajustando apenas os atributos que diferem.
 *
 * Idempotente: só insere se a tabela de projetos estiver vazia.
 */
async function semearProjetosModelo(): Promise<void> {
  const repositorioProjetos = AppDataSource.getRepository(Projeto);

  const existentes = await repositorioProjetos.count();
  if (existentes > 0) {
    // eslint-disable-next-line no-console
    console.log(`[seed] Banco já contém ${existentes} projeto(s). Nada a fazer.`);
    return;
  }

  const localizacaoSP = { latitude: -23.5505, longitude: -46.6333, cidade: 'São Paulo' };

  const modelos: Projeto[] = [
    new ProjetoDocumentario({
      titulo: 'Modelo · Documentário',
      genero: 'documentario',
      duracaoEstimadaMinutos: 60,
      orcamentoTotal: 40000,
      dataEntrega: emDias(365),
      tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
      localizacao: localizacaoSP,
      servicoPrincipal: new PacoteServico('Documentário', ModoExecucao.SEQUENCIAL, [
        new PacoteServico('Pré-produção', ModoExecucao.PARALELO, [
          new ServicoAtomico('Roteiro', PapelTecnico.ROTEIRISTA, 6000, 15),
          new ServicoAtomico('Direção', PapelTecnico.DIRETOR, 12000, 20)
        ]),
        new PacoteServico('Pós-produção', ModoExecucao.SEQUENCIAL, [
          new ServicoAtomico('Edição', PapelTecnico.EDITOR, 9000, 20),
          new ServicoAtomico('Mixagem', PapelTecnico.SONOPLASTA, 5000, 8)
        ])
      ]),
      produtorId: 'modelo',
      estrategiaRecomendacao: 'filtragem_colaborativa',
      tema: 'Tema a definir',
      entrevistados: ['Entrevistado a definir']
    }),
    new ProjetoAnimacao({
      titulo: 'Modelo · Animação',
      genero: 'animacao',
      duracaoEstimadaMinutos: 20,
      orcamentoTotal: 80000,
      dataEntrega: emDias(365),
      tipoCaptacao: TipoCaptacao.ANIMACAO,
      localizacao: localizacaoSP,
      servicoPrincipal: new PacoteServico('Animação', ModoExecucao.SEQUENCIAL, [
        new PacoteServico('Pré-produção', ModoExecucao.PARALELO, [
          new ServicoAtomico('Roteiro', PapelTecnico.ROTEIRISTA, 8000, 20),
          new ServicoAtomico('Direção', PapelTecnico.DIRETOR, 15000, 25)
        ]),
        new ServicoAtomico('Modelagem e efeitos', PapelTecnico.ESPECIALISTA_VFX, 30000, 45),
        new ServicoAtomico('Mixagem', PapelTecnico.SONOPLASTA, 6000, 10)
      ]),
      produtorId: 'modelo',
      estrategiaRecomendacao: 'similaridade_cosseno',
      tecnicaAnimacao: '3D',
      softwarePrincipal: 'Blender'
    }),
    new ProjetoPublicitario({
      titulo: 'Modelo · Publicitário',
      genero: 'publicidade',
      duracaoEstimadaMinutos: 1,
      orcamentoTotal: 25000,
      dataEntrega: emDias(150),
      tipoCaptacao: TipoCaptacao.FICCAO,
      localizacao: localizacaoSP,
      servicoPrincipal: new PacoteServico('Campanha', ModoExecucao.SEQUENCIAL, [
        new ServicoAtomico('Direção', PapelTecnico.DIRETOR, 8000, 5),
        new ServicoAtomico('Fotografia', PapelTecnico.DIRETOR_FOTOGRAFIA, 7000, 4),
        new ServicoAtomico('Edição', PapelTecnico.EDITOR, 5000, 6)
      ]),
      produtorId: 'modelo',
      estrategiaRecomendacao: 'orcamento_reduzido',
      marcaAnunciante: 'Marca a definir',
      dataVeiculacao: emDias(180)
    })
  ];

  await AppDataSource.manager.save(modelos);

  // eslint-disable-next-line no-console
  console.log(`[seed] ${modelos.length} projetos-modelo inseridos com sucesso.`);
}

/**
 * Popula o banco com profissionais de exemplo cobrindo todos os papéis
 * técnicos do enunciado e com um projeto-modelo para cada tipo de projeto,
 * permitindo testar o endpoint de recomendação imediatamente após subir o
 * ambiente, sem cadastro manual prévio.
 *
 * Idempotente: profissionais e projetos-modelo só são inseridos se as
 * respectivas tabelas estiverem vazias.
 */
async function seed(): Promise<void> {
  await AppDataSource.initialize();
  const repositorio = AppDataSource.getRepository(Profissional);

  const existentes = await repositorio.count();
  if (existentes > 0) {
    // eslint-disable-next-line no-console
    console.log(`[seed] Banco já contém ${existentes} profissional(is). Nada a fazer.`);
    await semearProjetosModelo();
    await AppDataSource.destroy();
    return;
  }

  const disponibilidadeAmpla = [{ inicio: new Date('2026-01-01'), fim: new Date('2030-12-31') }];
  const localizacaoSP = { latitude: -23.5505, longitude: -46.6333, cidade: 'São Paulo' };
  const localizacaoRJ = { latitude: -22.9068, longitude: -43.1729, cidade: 'Rio de Janeiro' };

  const profissionais: Profissional[] = [
    new Profissional({
      nome: 'Marina Alves',
      especialidadePrincipal: PapelTecnico.DIRETOR,
      faixaDePreco: { minimo: 8000, maximo: 15000 },
      disponibilidade: disponibilidadeAmpla,
      localizacao: localizacaoSP,
      historicoProjetos: ['doc-raizes-2024', 'ficcao-travessia-2025'],
      competencias: [
        new Competencia('direcao_atores', 0.95),
        new Competencia('visao_narrativa', 0.9),
        new Competencia('lideranca_equipe', 0.85)
      ],
      avaliacoes: [new Avaliacao(5, 'doc-raizes-2024'), new Avaliacao(4.5, 'ficcao-travessia-2025')]
    }),
    new Profissional({
      nome: 'Rafael Nogueira',
      especialidadePrincipal: PapelTecnico.DIRETOR,
      faixaDePreco: { minimo: 3000, maximo: 6000 },
      disponibilidade: disponibilidadeAmpla,
      localizacao: localizacaoRJ,
      historicoProjetos: ['curta-margens-2025'],
      competencias: [
        new Competencia('direcao_atores', 0.6),
        new Competencia('visao_narrativa', 0.65),
        new Competencia('lideranca_equipe', 0.5)
      ],
      avaliacoes: [new Avaliacao(3.5, 'curta-margens-2025')]
    }),
    new Profissional({
      nome: 'Beatriz Souza',
      especialidadePrincipal: PapelTecnico.DIRETOR_FOTOGRAFIA,
      faixaDePreco: { minimo: 5000, maximo: 9000 },
      disponibilidade: disponibilidadeAmpla,
      localizacao: localizacaoSP,
      historicoProjetos: ['doc-raizes-2024', 'publi-verao-2025', 'ficcao-travessia-2025'],
      competencias: [
        new Competencia('iluminacao_natural', 0.9),
        new Competencia('composicao_imagem', 0.92),
        new Competencia('operacao_camera', 0.88)
      ],
      avaliacoes: [new Avaliacao(4.8, 'doc-raizes-2024'), new Avaliacao(5, 'ficcao-travessia-2025')]
    }),
    new Profissional({
      nome: 'Thiago Martins',
      especialidadePrincipal: PapelTecnico.SONOPLASTA,
      faixaDePreco: { minimo: 2500, maximo: 4500 },
      disponibilidade: disponibilidadeAmpla,
      localizacao: localizacaoSP,
      historicoProjetos: ['curta-margens-2025', 'doc-raizes-2024'],
      competencias: [
        new Competencia('captacao_som_direto', 0.85),
        new Competencia('mixagem_audio', 0.8),
        new Competencia('design_sonoro', 0.75)
      ],
      avaliacoes: [new Avaliacao(4.2, 'curta-margens-2025')]
    }),
    new Profissional({
      nome: 'Camila Ferreira',
      especialidadePrincipal: PapelTecnico.EDITOR,
      faixaDePreco: { minimo: 3500, maximo: 7000 },
      disponibilidade: disponibilidadeAmpla,
      localizacao: localizacaoRJ,
      historicoProjetos: ['ficcao-travessia-2025', 'publi-verao-2025', 'doc-raizes-2024'],
      competencias: [
        new Competencia('edicao_avancada', 0.93),
        new Competencia('ritmo_narrativo', 0.9),
        new Competencia('color_grading', 0.7)
      ],
      avaliacoes: [new Avaliacao(4.9, 'ficcao-travessia-2025'), new Avaliacao(4.6, 'publi-verao-2025')]
    }),
    new Profissional({
      nome: 'Lucas Pereira',
      especialidadePrincipal: PapelTecnico.ROTEIRISTA,
      faixaDePreco: { minimo: 2000, maximo: 4000 },
      disponibilidade: disponibilidadeAmpla,
      localizacao: localizacaoSP,
      historicoProjetos: ['doc-raizes-2024'],
      competencias: [
        new Competencia('estrutura_narrativa', 0.8),
        new Competencia('dialogo', 0.75),
        new Competencia('pesquisa_tematica', 0.85)
      ],
      avaliacoes: [new Avaliacao(4.3, 'doc-raizes-2024')]
    }),
    new Profissional({
      nome: 'Juliana Costa',
      especialidadePrincipal: PapelTecnico.ESPECIALISTA_VFX,
      faixaDePreco: { minimo: 4000, maximo: 8000 },
      disponibilidade: disponibilidadeAmpla,
      localizacao: localizacaoRJ,
      historicoProjetos: ['ficcao-travessia-2025'],
      competencias: [
        new Competencia('composicao_digital', 0.88),
        new Competencia('modelagem_3d', 0.7),
        new Competencia('motion_graphics', 0.82)
      ],
      avaliacoes: [new Avaliacao(4.7, 'ficcao-travessia-2025')]
    })
  ];

  await repositorio.save(profissionais);

  // eslint-disable-next-line no-console
  console.log(`[seed] ${profissionais.length} profissionais inseridos com sucesso.`);

  await semearProjetosModelo();
  await AppDataSource.destroy();
}

seed().catch((erro) => {
  // eslint-disable-next-line no-console
  console.error('[seed] Falha ao popular o banco:', erro);
  process.exit(1);
});
