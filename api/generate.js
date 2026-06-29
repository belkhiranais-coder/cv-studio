export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  const { mode, offer, cv } = req.body;
  if (!offer) return res.status(400).json({ error: 'Missing offer text' });

  // ── PROFIL SIGNATURE ANAÏS ──
  const SIGNATURE = `
Profil candidat (à intégrer naturellement, sans jamais le copier-coller tel quel) :
- Déterminée, ambitieuse, créative, très analytique
- Aime rendre les choses concrètes : déployer des outils, mettre en place l'IA, optimiser les coûts, structurer les process
- Attirée par les projets "infaisables", la course à la compétitivité, l'aspect stratégique
- Cherche à sentir son impact, être impliquée dans les décisions, faire évoluer l'entreprise
- En poste et épanouie — candidate pour tester le marché et trouver encore plus grand
- Spontanée dans la recherche de solutions, initiative naturelle
`;

  let prompt;

  if (mode === 'cv') {
    // ── MODE ADAPTATION CV ──
    prompt = `Tu es expert en optimisation de CV pour recrutement en France.
Tu reçois une offre d'emploi et un CV existant au format JSON.

RÈGLES ABSOLUES :
- Ne JAMAIS inventer de faits, d'expériences ou de compétences inexistantes
- Reformuler les bullets avec les mots-clés de l'offre quand c'est naturellement justifié
- Réordonner les compétences pour mettre en avant celles qui matchent
- Adapter le titre et le profil pour résonner avec l'offre sans copier son intitulé exactement
- Rester factuel, sobre — pas de sur-adaptation voyante
- Les bullets doivent sonner vrais, pas comme du keyword stuffing

${SIGNATURE}

OFFRE D'EMPLOI :
${offer}

CV ACTUEL :
${JSON.stringify(cv, null, 2)}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
{
  "title": "titre ciblé sobre",
  "profil": "texte profil 3-4 lignes max",
  "competences": ["comp1", "comp2", ...],
  "experiences": [
    {
      "role": "intitulé poste",
      "co": "entreprise (inchangée)",
      "sub": "sous-titre (inchangé)",
      "date": "dates (inchangées)",
      "badge": "badge (inchangé)",
      "bullets": ["bullet 1", "bullet 2", ...]
    }
  ]
}`;

  } else if (mode === 'cover') {
    // ── MODE LETTRE DE MOTIVATION ──
    prompt = `Tu es expert en rédaction de lettres de motivation percutantes en France.
Tu dois écrire une lettre qui SORT DU LOT — originale, authentique, calibrée pour passer les ATS et convaincre un recruteur humain.

${SIGNATURE}

STRATÉGIE ANTI-GÉNÉRIQUE :
- Ouvrir avec une accroche forte et spécifique à cette offre/entreprise — jamais "Je me permets de vous adresser ma candidature"
- Montrer que tu as compris les vrais enjeux du poste (pas juste recopier l'annonce)
- 1 ou 2 réalisations chiffrées concrètes qui prouvent la valeur
- Montrer la personnalité : déterminée, créative, analytique — avec des preuves, pas des adjectifs
- Ton direct, affirmé, légèrement confiant sans arrogance
- Fermer avec une proposition d'action claire, pas une formule de politesse vague
- Format : 4 paragraphes courts, ~300-350 mots, sobre visuellement

STRUCTURE :
1. Accroche (1-2 phrases) : angle surprise ou insight sur l'entreprise/le secteur
2. Pourquoi ce poste / cette entreprise : enjeux compris, motivation sincère
3. Ce que j'apporte : 2-3 réalisations concrètes chiffrées + soft skills prouvés
4. Ouverture : appel à l'action direct et confiant

OFFRE D'EMPLOI :
${offer}

CV (contexte) :
${JSON.stringify(cv, null, 2)}

Réponds en JSON valide sans backticks :
{
  "subject": "Objet de l'email de candidature (accrocheur, pas générique)",
  "letter": "Texte complet de la lettre avec \\n pour les sauts de ligne"
}`;

  } else {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `Anthropic error ${response.status}` });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';

    // Robuste : strip markdown si présent
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ ok: true, result: parsed });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
