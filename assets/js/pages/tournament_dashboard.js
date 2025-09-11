import { supabase } from '../supabaseClient.js';

export default function TournamentDashboardPage({ id }) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <a href="#/app/tournaments" class="text-sm text-gray-500">← Mes tournois</a>
        <h1 id="tt-name" class="text-2xl font-semibold mt-1">Tournoi</h1>
      </div>
      <div class="flex gap-2">
        <a href="#/app/t/${id}/schedule" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Planning</a>
        <a href="#/app/t/${id}/teams" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Équipes</a>
      </div>
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
  // If navigated just after creation, show contextual animation on dashboard header
  try {
    const createdId = sessionStorage.getItem('justCreatedTournamentId');
    if (createdId && createdId === id) {
      sessionStorage.removeItem('justCreatedTournamentId');
      const headerName = document.getElementById('tt-name');
      if (headerName) {
        headerName.classList.add('ring-2','ring-primary','rounded-xl','px-1');
        setTimeout(() => {
          headerName.classList.remove('ring-2','ring-primary');
        }, 1000);
      }
      try { window.showToast && window.showToast('Tournoi prêt. Configurez vos équipes et le planning.', { type: 'success' }); } catch {}
    }
  } catch {}
}

async function load(id) {
  const { data: t, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
  if (error) { console.error(error); return; }
  document.getElementById('tt-name').textContent = t.name;
  document.getElementById('tt-format').textContent = t.format === 'knockout' ? 'Élimination directe' : 'Poules + Phase finale';

  const { count } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('tournament_id', id);
  document.getElementById('tt-teams').textContent = String(count ?? 0);
}
