export class ErroApiProfissional extends Error {
  constructor(readonly codigo: 'PERFIL_INEXISTENTE', message: string) {
    super(message);
  }
}

export interface PerfilPortal {
  id: string;
  nomeCompleto: string;
  cargo: string;
  cidade: string;
  coordenadas: { lat: number; lon: number };
  pretensaoSalarial: { de: number; ate: number };
  habilidades: string[];
  disponivelDe: string;
  disponivelAte: string;
  projetosAnteriores: string[];
  notas: number[];
}

export const PERFIS_PORTAL_PADRAO: PerfilPortal[] = [
  {
    id: 'ind-201', nomeCompleto: 'Rafael Nogueira Lima', cargo: 'DIRETOR_DE_CINEMA', cidade: 'Rio de Janeiro',
    coordenadas: { lat: -22.9068, lon: -43.1729 }, pretensaoSalarial: { de: 3000, ate: 6000 },
    habilidades: ['direção de atores', 'visão narrativa'], disponivelDe: '2026-01-01', disponivelAte: '2030-12-31',
    projetosAnteriores: ['ind-curta-2025'], notas: [3.5, 4]
  },
  {
    id: 'ind-202', nomeCompleto: 'Larissa Prado', cargo: 'EDITOR_DE_VIDEO', cidade: 'São Paulo',
    coordenadas: { lat: -23.5505, lon: -46.6333 }, pretensaoSalarial: { de: 3500, ate: 7000 },
    habilidades: ['edição avançada', 'ritmo narrativo', 'correção de cor'], disponivelDe: '2026-01-01', disponivelAte: '2030-12-31',
    projetosAnteriores: ['ind-doc-2025', 'ind-publi-2025'], notas: [4.5, 5, 4.8]
  },
  {
    id: 'ind-203', nomeCompleto: 'Otávio Brandão', cargo: 'TECNICO_DE_SOM', cidade: 'São Paulo',
    coordenadas: { lat: -23.5505, lon: -46.6333 }, pretensaoSalarial: { de: 2000, ate: 4200 },
    habilidades: ['captação de som direto', 'mixagem de áudio'], disponivelDe: '2026-01-01', disponivelAte: '2030-12-31',
    projetosAnteriores: ['ind-curta-2025'], notas: [4.2]
  },
  {
    id: 'ind-204', nomeCompleto: 'Priscila Aragão', cargo: 'ROTEIRISTA', cidade: 'Recife',
    coordenadas: { lat: -8.0476, lon: -34.877 }, pretensaoSalarial: { de: 2200, ate: 4500 },
    habilidades: ['estrutura narrativa', 'diálogo', 'pesquisa temática'], disponivelDe: '2026-01-01', disponivelAte: '2030-12-31',
    projetosAnteriores: ['ind-doc-2025'], notas: [4.6]
  }
];

/**
 * Sistema externo simulado: um portal de empregos especializado (perfis com
 * `cargo`, `habilidades` em texto livre, `pretensaoSalarial`, notas soltas).
 * API própria e síncrona: `buscarProfissionais`, `obterPerfil`,
 * `avaliarProfissional`.
 */
export class ApiProfissionalExterna {
  private readonly perfis: PerfilPortal[];

  constructor(perfis: PerfilPortal[] = PERFIS_PORTAL_PADRAO) {
    this.perfis = structuredClone(perfis);
  }

  buscarProfissionais(filtros: { categoria?: string; cidade?: string } = {}): PerfilPortal[] {
    return structuredClone(
      this.perfis.filter(
        (perfil) =>
          (!filtros.categoria || perfil.cargo === filtros.categoria) &&
          (!filtros.cidade || perfil.cidade.toLowerCase() === filtros.cidade.toLowerCase())
      )
    );
  }

  obterPerfil(id: string): PerfilPortal {
    return structuredClone(this.exigir(id));
  }

  avaliarProfissional(id: string, nota: number): void {
    this.exigir(id).notas.push(nota);
  }

  private exigir(id: string): PerfilPortal {
    const perfil = this.perfis.find((p) => p.id === id);
    if (!perfil) throw new ErroApiProfissional('PERFIL_INEXISTENTE', `Perfil inexistente: ${id}`);
    return perfil;
  }
}
