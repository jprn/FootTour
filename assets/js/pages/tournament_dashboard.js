import { supabase } from '../supabaseClient.js';

export default function TournamentDashboardPage({ id }) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <a href="#/app/tournaments" class="text-sm text-gray-500">← Mes tournois</a>
        <h1 id="tt-name" class="text-2xl font-semibold mt-1">Tournoi</h1>
      </div>
      <div class="flex gap-2" id="tt-actions">
        <!-- Actions populated dynamically -->
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

    <section id="tt-groups" class="mt-8"></section>
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

  // Render groups summary if any
  const host = document.getElementById('tt-groups');
  if (!host) return;
  const { data: groups } = await supabase.from('groups').select('id, name').eq('tournament_id', id).order('name', { ascending: true });
  const actions = document.getElementById('tt-actions');
  // Always provide a link to the Matches page for score entry
  if (actions) {
    const matchesLink = document.createElement('a');
    matchesLink.href = `#/app/t/${id}/matches`;
    matchesLink.className = 'px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20';
    matchesLink.textContent = 'Matchs';
    actions.append(matchesLink);
  }
  if (t.format === 'groups_knockout') {
    // If no groups, offer generation CTA; else show Planning CTA
    if (!groups?.length) {
      const btn = document.createElement('button');
      btn.id = 'tt-generate-groups';
      btn.className = 'px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20';
      btn.textContent = 'Générer les poules';
      btn.addEventListener('click', async () => {
        await createRandomGroupsAndGenerate(id);
        try { window.showToast && window.showToast('Poules + calendrier générés', { type: 'success' }); } catch {}
        location.hash = `#/app/t/${id}/schedule`;
      });
      actions?.prepend(btn);
    } else {
      const link = document.createElement('a');
      link.href = `#/app/t/${id}/schedule`;
      link.className = 'px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20';
      link.textContent = 'Planning';
      actions?.prepend(link);
    }
  }
  if (!groups?.length) {
    host.innerHTML = '';
    return;
  }
  const { data: teams } = await supabase.from('teams').select('id, name, group_id').eq('tournament_id', id).order('name', { ascending: true });
  const byGroup = Object.fromEntries(groups.map(g => [g.id, []]));
  (teams||[]).forEach(tm => { if (byGroup[tm.group_id]) byGroup[tm.group_id].push(tm); });
  host.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold">Poules</h2>
      <a href="#/app/t/${id}/schedule" class="text-sm underline">Ouvrir le planning</a>
    </div>
    <div class="mt-3 grid md:grid-cols-3 gap-4">
      ${groups.map(g => `
        <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
          <div class="font-semibold">Poule ${g.name}</div>
          <ul class="mt-2 space-y-1 text-sm">
            ${(byGroup[g.id]||[]).map(tm => `<li>• ${tm.name}</li>`).join('') || '<li class="opacity-70">(aucune équipe)</li>'}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

// Helpers reused from schedule.js logic
function recommendGroups(totalTeams, maxGroups) {
  const minGroups = 2;
  const targetSize = 4.5;
  let bestK = Math.min(Math.max(minGroups, Math.floor(totalTeams / targetSize)), maxGroups);
  let bestScore = Infinity;
  for (let k = minGroups; k <= maxGroups; k++) {
    const size = totalTeams / k;
    const balancePenalty = (totalTeams % k === 0) ? 0 : 0.3;
    const sizePenalty = Math.abs(size - targetSize);
    const score = sizePenalty + balancePenalty;
    if (score < bestScore) { bestScore = score; bestK = k; }
  }
  return bestK;
}

async function createRandomGroupsAndGenerate(tournamentId) {
  const { data: teams, error } = await supabase.from('teams').select('id, name').eq('tournament_id', tournamentId).order('created_at', { ascending: true });
  if (error) { alert(error.message); return; }
  if (!teams?.length) { alert('Aucune équipe dans le tournoi.'); return; }
  const maxGroups = Math.min(8, teams.length);
  const rec = recommendGroups(teams.length, maxGroups);
  let n = parseInt(prompt(`Nombre de poules (2 à ${maxGroups}) ?\nRecommandé: ${rec} (≈ ${Math.ceil(teams.length/rec)} équipes/poule)`, String(rec)) || '0', 10);
  if (!Number.isFinite(n) || n < 2 || n > maxGroups) { alert('Nombre de poules invalide.'); return; }
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const payload = Array.from({ length: n }).map((_, i) => ({ tournament_id: tournamentId, name: letters[i] }));
  const { data: created, error: gErr } = await supabase.from('groups').insert(payload).select('id, name').order('name', { ascending: true });
  if (gErr) { alert(gErr.message); return; }
  for (let i = 0; i < shuffled.length; i++) {
    const g = created[i % created.length];
    const team = shuffled[i];
    const { error: uErr } = await supabase.from('teams').update({ group_id: g.id }).eq('id', team.id);
    if (uErr) { alert(uErr.message); return; }
  }
  // generate round robin
  let toInsert = [];
  for (const g of created) {
    const { data: tms } = await supabase.from('teams').select('id').eq('group_id', g.id).order('created_at', { ascending: true });
    for (let i = 0; i < (tms||[]).length; i++) {
      for (let j = i + 1; j < (tms||[]).length; j++) {
        toInsert.push({ tournament_id: tournamentId, group_id: g.id, round: `Poule ${g.name}`, home_team_id: tms[i].id, away_team_id: tms[j].id, status: 'scheduled' });
      }
    }
  }
  if (toInsert.length) {
    const { error: mErr } = await supabase.from('matches').insert(toInsert);
    if (mErr) { alert(mErr.message); return; }
  }
}
