export class ErroLinkedIn extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface PerfilLinkedIn {
  urn: string;
  firstName: string;
  lastName: string;
  headline: string;
  location: { city: string; country: string; lat: number; lng: number };
  skills: Array<{ name: string; endorsementCount: number }>;
  rateCardBRL: { min: number; max: number };
  availability: Array<{ from: string; to: string }>;
  pastProjects: string[];
  recommendations: Array<{ stars: number; projectId: string; text: string }>;
}

const disponivel = [{ from: '2026-01-01', to: '2030-12-31' }];
const saoPaulo = { city: 'São Paulo', country: 'BR', lat: -23.5505, lng: -46.6333 };
const rio = { city: 'Rio de Janeiro', country: 'BR', lat: -22.9068, lng: -43.1729 };

export const PERFIS_LINKEDIN_PADRAO: PerfilLinkedIn[] = [
  {
    urn: 'urn:li:person:1001', firstName: 'Helena', lastName: 'Duarte', headline: 'Film Director', location: saoPaulo,
    skills: [{ name: 'Actor direction', endorsementCount: 18 }, { name: 'Narrative vision', endorsementCount: 16 }, { name: 'Team leadership', endorsementCount: 12 }],
    rateCardBRL: { min: 7000, max: 12000 }, availability: disponivel,
    pastProjects: ['li-ficcao-2025', 'li-doc-2024'],
    recommendations: [{ stars: 5, projectId: 'li-ficcao-2025', text: 'Direção impecável.' }, { stars: 4, projectId: 'li-doc-2024', text: 'Ótima condução.' }]
  },
  {
    urn: 'urn:li:person:1002', firstName: 'Bruno', lastName: 'Tavares', headline: 'Video Editor', location: rio,
    skills: [{ name: 'Advanced editing', endorsementCount: 15 }, { name: 'Color grading', endorsementCount: 10 }, { name: 'Narrative rhythm', endorsementCount: 9 }],
    rateCardBRL: { min: 3000, max: 6000 }, availability: disponivel,
    pastProjects: ['li-clipe-2025'], recommendations: [{ stars: 5, projectId: 'li-clipe-2025', text: 'Montagem precisa.' }]
  },
  {
    urn: 'urn:li:person:1003', firstName: 'Sofia', lastName: 'Matos', headline: 'VFX Artist', location: saoPaulo,
    skills: [{ name: '3D modeling', endorsementCount: 17 }, { name: 'Motion graphics', endorsementCount: 12 }, { name: 'Digital compositing', endorsementCount: 9 }],
    rateCardBRL: { min: 5000, max: 9000 }, availability: disponivel,
    pastProjects: ['li-anim-2025', 'li-ficcao-2025'], recommendations: [{ stars: 5, projectId: 'li-anim-2025', text: 'Efeitos de altíssimo nível.' }]
  },
  {
    urn: 'urn:li:person:1004', firstName: 'Caio', lastName: 'Ramos', headline: 'Sound Designer', location: saoPaulo,
    skills: [{ name: 'Audio mixing', endorsementCount: 14 }, { name: 'Sound design', endorsementCount: 11 }],
    rateCardBRL: { min: 2500, max: 5000 }, availability: disponivel,
    pastProjects: ['li-doc-2024'], recommendations: [{ stars: 4, projectId: 'li-doc-2024', text: 'Som limpo.' }]
  },
  {
    urn: 'urn:li:person:1005', firstName: 'Marta', lastName: 'Nunes', headline: 'Director of Photography', location: rio,
    skills: [{ name: 'Natural lighting', endorsementCount: 13 }, { name: 'Image composition', endorsementCount: 14 }, { name: 'Camera operation', endorsementCount: 10 }],
    rateCardBRL: { min: 5500, max: 9500 }, availability: disponivel,
    pastProjects: ['li-ficcao-2025'], recommendations: [{ stars: 5, projectId: 'li-ficcao-2025', text: 'Luz incrível.' }]
  }
];

/**
 * Sistema externo simulado: imita uma rede social profissional (perfis com
 * `headline`, `skills` endossadas, `rateCardBRL`, recomendações em estrelas).
 */
export class LinkedInSimulado {
  private readonly perfis: PerfilLinkedIn[];

  constructor(perfis: PerfilLinkedIn[] = PERFIS_LINKEDIN_PADRAO) {
    this.perfis = structuredClone(perfis);
  }

  async searchPeople(filtros: { keywords?: string; location?: string } = {}): Promise<{ elements: PerfilLinkedIn[] }> {
    const elements = this.perfis.filter(
      (perfil) =>
        (!filtros.keywords || perfil.headline.toLowerCase().includes(filtros.keywords.toLowerCase())) &&
        (!filtros.location || perfil.location.city.toLowerCase().includes(filtros.location.toLowerCase()))
    );
    return { elements: structuredClone(elements) };
  }

  async getProfile(urn: string): Promise<PerfilLinkedIn> {
    return structuredClone(this.exigir(urn));
  }

  async createRecommendation(urn: string, recomendacao: { rating: number; projectId: string; text: string }): Promise<void> {
    this.exigir(urn).recommendations.push({ stars: recomendacao.rating, projectId: recomendacao.projectId, text: recomendacao.text });
  }

  private exigir(urn: string): PerfilLinkedIn {
    const perfil = this.perfis.find((p) => p.urn === urn);
    if (!perfil) throw new ErroLinkedIn(404, `Profile not found: ${urn}`);
    return perfil;
  }
}
