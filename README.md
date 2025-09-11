# FootTour (Windsurf + Supabase)

SaaS de gestion de tournois multi-sport. Frontend statique en HTML/CSS/JS (Tailwind via CDN), connexion Supabase.

## Démarrage rapide

1. Créez un projet Supabase et récupérez:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. Ouvrez `assets/js/supabaseClient.js` et remplacez les placeholders.
3. Dans Supabase SQL editor, copiez le contenu de `supabase/schema.sql` pour créer les tables et politiques RLS.
4. Servez les fichiers statiques (ex: via extension Live Server ou `python -m http.server`):
   - macOS/Linux: `python3 -m http.server 5173`
   - Puis ouvrez http://localhost:5173

## Pages initiales (Sprint 1)

- `/` Landing + modal Auth (magic link / email+password)
- `/app/tournaments` Liste & création de tournois
- `/app/t/:id` Tableau de bord d'un tournoi
- `/app/t/:id/teams` Gestion des équipes

## Schéma (extrait Sprint 1)
- `profiles` (liés à auth.users)
- `tournaments`
- `groups`
- `teams`

Les politiques RLS limitent l'écriture aux organisateurs (owner = auth.uid()). Lecture restreinte aux propriétaires pour l'app, publique par `slug` à implémenter plus tard.

## Roadmap
- Sprint 1: Auth, tournois, équipes, poules (UI de base)
- Sprint 2: Génération planning poules (round robin), saisie scores, classements
- Sprint 3: Bracket phase finale + page publique
- Sprint 4: Multi-discipline, exports PDF/CSV, monétisation Stripe

## Config Tailwind
Utilisation CDN pour prototypage. Pour la prod, passer à une build Tailwind dédiée.
