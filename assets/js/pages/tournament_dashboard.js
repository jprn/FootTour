import { supabase } from '../supabaseClient.js';

export default function TournamentDashboardPage({ id }) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <a href="#/app/tournaments" class="text-sm text-gray-500">← Mes tournois</a>
        <h1 id="tt-name" class="text-2xl font-semibold mt-1">Tournoi</h1>
      </div>
      <a href="#/app/t/${id}/teams" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Équipes</a>
    </div>
    <section class="mt-6 grid md:grid-cols-3 gap-4">
      <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="text-sm text-gray-500">Format</div>
        <div id="tt-format" class="font-medium">—</div>
      </div>
      <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="text-sm text-gray-500">Équipes</div>
        <div id="tt-teams" class="font-medium">—</div>
      </div>
      <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="text-sm text-gray-500">Statut</div>
        <div id="tt-status" class="font-medium">Brouillon</div>
      </div>
    </section>
  `;
}

export function onMountTournamentDashboard({ id }) {
  load(id);
}

async function load(id) {
  const { data: t, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
  if (error) { console.error(error); return; }
  document.getElementById('tt-name').textContent = t.name;
  document.getElementById('tt-format').textContent = t.format === 'knockout' ? 'Élimination directe' : 'Poules + Phase finale';

  const { count } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('tournament_id', id);
  document.getElementById('tt-teams').textContent = String(count ?? 0);
}
