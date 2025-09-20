import { supabase } from '../supabaseClient.js';

export default function SchedulePage({ id }) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <a href="#/app/t/${id}" class="text-sm text-gray-500">← Tableau de bord</a>
        <h1 class="text-2xl font-semibold mt-1">Programme des rencontres</h1>
      </div>
      <div id="schedule-actions" class="flex gap-2 items-center">
        <a href="#/app/t/${id}/matches" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Matchs</a>
        <a href="#/app/t/${id}/standings" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Classement</a>
      </div>
    </div>

    <section id="schedule-content" class="mt-6 space-y-6">
      <div id="format-info" class="text-sm text-gray-500">Chargement du tournoi…</div>
      <div id="groups-summary" class="grid md:grid-cols-3 gap-4"></div>
      <div id="matches-list" class="grid md:grid-cols-2 gap-4"></div>
    </section>
  `;
}

// Heuristic to recommend number of groups aiming for ~4-5 teams per group and balanced distribution
function recommendGroups(totalTeams, maxGroups) {
  const minGroups = 2;
  const targetSize = 4.5; // prefer groups of 4-5
  let bestK = Math.min(Math.max(minGroups, Math.floor(totalTeams / targetSize)), maxGroups);
  let bestScore = Infinity;
  for (let k = minGroups; k <= maxGroups; k++) {
    const size = totalTeams / k;
    const balancePenalty = (totalTeams % k === 0) ? 0 : 0.3; // prefer even split
    const sizePenalty = Math.abs(size - targetSize);
    const score = sizePenalty + balancePenalty;
    if (score < bestScore) { bestScore = score; bestK = k; }
  }
  return bestK;
}

async function createRandomGroups(tournamentId) {
  // fetch all teams of tournament
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) { alert(error.message); return; }
  if (!teams?.length) { alert('Aucune équipe dans le tournoi.'); return; }

  // ask number of groups
  const maxGroups = Math.min(8, teams.length);
  const recommended = recommendGroups(teams.length, maxGroups);
  let n = parseInt(
    prompt(
      `Nombre de poules (2 à ${maxGroups}) ?\nRecommandé: ${recommended} (≈ ${Math.ceil(teams.length / recommended)} équipes/poule)`,
      String(recommended)
    ) || '0',
    10
  );
  if (!Number.isFinite(n) || n < 2 || n > maxGroups) { alert('Nombre de poules invalide.'); return; }

  // shuffle teams
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  // create groups A, B, C...
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const groupPayload = Array.from({ length: n }).map((_, i) => ({ tournament_id: tournamentId, name: letters[i] }));
  const { data: created, error: gErr } = await supabase.from('groups').insert(groupPayload).select('id, name').order('name', { ascending: true });
  if (gErr) { alert(gErr.message); return; }

  // assign teams round-robin into groups
  for (let i = 0; i < shuffled.length; i++) {
    const g = created[i % created.length];
    const team = shuffled[i];
    const { error: uErr } = await supabase.from('teams').update({ group_id: g.id }).eq('id', team.id);
    if (uErr) { alert(uErr.message); return; }
  }

  try { window.showToast && window.showToast('Poules créées aléatoirement. Génération du calendrier…', { type: 'success' }); } catch {}
  await generateGroupRoundRobin(tournamentId);
  try { window.showToast && window.showToast('Répartition rejouée. Génération du calendrier…', { type: 'success' }); } catch {}
  await renderGroups(tournamentId);
}

export function onMountSchedule({ id }) {
  init(id);
}

function scrollToMatches() {
  const el = document.getElementById('matches-list');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function init(id) {
  const info = document.getElementById('format-info');

  const { data: t, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
  if (error) { info.textContent = error.message; return; }
  // Check if matches already exist
  const { count: matchCount } = await supabase.from('matches').select('id', { count: 'exact', head: true }).eq('tournament_id', id);
  // Count groups to decide which actions to display
  const { count: groupsCount } = await supabase.from('groups').select('id', { count: 'exact', head: true }).eq('tournament_id', id);
  // Check if any group match is already LIVE or FINISHED (to lock regen)
  const { count: lockedCount } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', id)
    .not('group_id', 'is', null)
    .in('status', ['live','finished']);
  // Check if KO already has Petite finale or Finale (to lock regen UX globally)
  let hasBlockingKO = false;
  try {
    const { data: koRounds } = await supabase
      .from('matches')
      .select('round, group_id')
      .eq('tournament_id', id)
      .is('group_id', null);
    hasBlockingKO = (koRounds||[]).some(m => {
      const r = String(m.round||'').toLowerCase();
      return r.includes('petite') || (r.includes('finale') && !r.includes('demi'));
    });
  } catch {}
  const actions = document.getElementById('schedule-actions');
  if (actions) {
    // Clear previous dynamic buttons (keep first child which is the Classement link)
    Array.from(actions.querySelectorAll('[data-dyn]')).forEach(n => n.remove());
    if ((groupsCount ?? 0) === 0 && t.format === 'groups_knockout') {
      const genBtn = document.createElement('button');
      genBtn.setAttribute('data-dyn', '1');
      genBtn.id = 'gen-groups-btn';
      genBtn.className = 'px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20';
      genBtn.textContent = 'Générer les poules';
      genBtn.addEventListener('click', async () => { await createRandomGroups(id); });
      actions.prepend(genBtn);
    } else if ((groupsCount ?? 0) > 0) {
      const regenBtn = document.createElement('button');
      regenBtn.setAttribute('data-dyn', '1');
      regenBtn.id = 'regen-groups-calendar-btn';
      regenBtn.className = 'px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20';
      regenBtn.textContent = 'Régénérer le calendrier';
      const isLocked = (lockedCount ?? 0) > 0;
      if (hasBlockingKO) {
        regenBtn.title = 'Indisponible: Petite finale ou Finale existante — régénération bloquée';
        regenBtn.disabled = true;
      } else if (isLocked) {
        regenBtn.title = 'Indisponible: au moins un match de poule est En direct ou Terminé';
        regenBtn.disabled = true;
      } else {
        regenBtn.title = 'Supprime les matchs de poule et recrée le calendrier';
        regenBtn.addEventListener('click', async () => { await generateGroupRoundRobin(id); await renderMatchesByGroup(id); });
      }
      actions.prepend(regenBtn);
    }
  }
  if (t.format === 'groups_knockout') {
    info.textContent = 'Format: Poules + Phase finale';

    // Show groups summary
    await renderGroups(id);

    // Offer info message if no groups exist
    const { count } = await supabase.from('groups').select('id', { count: 'exact', head: true }).eq('tournament_id', id);
    if ((count ?? 0) === 0) {
      const list = document.getElementById('matches-list');
      list.innerHTML = '<div class="col-span-full text-sm opacity-70">Aucune poule. Créez-les depuis le tableau de bord (bouton "Générer les poules").</div>';
    } else if ((matchCount ?? 0) === 0) {
      // Auto-generate round robin if we have groups and no matches yet
      await generateGroupRoundRobin(id);
    }
  } else {
    info.textContent = 'Format: Élimination directe';
    if ((matchCount ?? 0) === 0) {
      await generateKnockout(id);
    }
  }

  await renderMatchesByGroup(id);
}

async function renderMatchesByGroup(tournamentId) {
  const list = document.getElementById('matches-list');
  list.innerHTML = '<div class="col-span-full text-sm opacity-70">Chargement…</div>';
  // detect groups
  const { data: groups } = await supabase.from('groups').select('id, name').eq('tournament_id', tournamentId).order('name', { ascending: true });
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, group_id, round, start_time, status, home:home_team_id(name), away:away_team_id(name)')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true });
  if (error) { list.innerHTML = `<div class=\"text-red-600\">${error.message}</div>`; return; }
  if (!matches?.length) { list.innerHTML = '<div class="opacity-70">Aucun match pour le moment.</div>'; return; }

  if (groups?.length) {
    const byGroup = Object.fromEntries(groups.map(g => [g.id, []]));
    matches.forEach(m => { if (byGroup[m.group_id]) byGroup[m.group_id].push(m); });
    list.innerHTML = groups.map(g => `
      <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="font-semibold">Poule ${g.name}</div>
        <div class="mt-2 space-y-2">
          ${(byGroup[g.id]||[]).map(m => `
            <div class="text-sm">
              <div class="font-medium">${m.home?.name || '—'} vs ${m.away?.name || '—'}</div>
              <div class="text-gray-500">${m.round || ''} ${m.start_time ? '· ' + new Date(m.start_time).toLocaleString() : ''} ${m.status ? '· ' + m.status : ''}</div>
            </div>
          `).join('') || '<div class="text-sm opacity-70">Aucun match</div>'}
        </div>
      </div>
    `).join('');
  } else {
    // knockout: render single card
    list.innerHTML = `
      <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="font-semibold">Élimination directe</div>
        <div class="mt-2 space-y-2">
          ${matches.map(m => `
            <div class="text-sm">
              <div class="font-medium">${m.home?.name || '—'} vs ${m.away?.name || '—'}</div>
              <div class="text-gray-500">${m.round || ''} ${m.start_time ? '· ' + new Date(m.start_time).toLocaleString() : ''} ${m.status ? '· ' + m.status : ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

async function generateGroupRoundRobin(tournamentId) {
  // Fetch groups and teams per group
  const { data: groups, error: gErr } = await supabase.from('groups').select('id, name').eq('tournament_id', tournamentId).order('position', { ascending: true });
  if (gErr) { alert(gErr.message); return; }
  if (!groups?.length) { alert('Aucune poule. Créez d\'abord des poules et des équipes.'); return; }

  // Clear existing group matches for this tournament to avoid duplicates
  {
    const { error: delErr } = await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .not('group_id', 'is', null);
    if (delErr) { alert(delErr.message); return; }
  }

  let toInsert = [];
  for (const g of groups) {
    const { data: teams, error: tErr } = await supabase.from('teams').select('id, name').eq('group_id', g.id).order('created_at', { ascending: true });
    if (tErr) { alert(tErr.message); return; }
    // Round-robin simple: chaque paire une fois
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        toInsert.push({
          tournament_id: tournamentId,
          group_id: g.id,
          round: `Poule ${g.name}`,
          home_team_id: teams[i].id,
          away_team_id: teams[j].id,
          status: 'scheduled',
        });
      }
    }
  }
  if (!toInsert.length) { alert('Pas assez d\'équipes dans les poules.'); return; }
  const { error } = await supabase.from('matches').insert(toInsert);
  if (error) { alert(error.message); return; }
  try {
    window.showToast && window.showToast('Calendrier des poules généré', {
      type: 'success',
      actionLabel: 'Voir les matchs',
      onAction: () => scrollToMatches(),
    });
  } catch {}
  await renderGroups(tournamentId);
  await renderMatchesByGroup(tournamentId);
}

async function generateKnockout(tournamentId) {
  // Fetch all teams of tournament
  const { data: teams, error } = await supabase.from('teams').select('id, name').eq('tournament_id', tournamentId).order('created_at', { ascending: true });
  if (error) { alert(error.message); return; }
  const n = teams.length;
  if (n < 2) { alert('Pas assez d\'équipes pour générer un bracket.'); return; }
  // If knockout matches already exist, confirm replacement and clear them
  {
    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .is('group_id', null);
    if ((count ?? 0) > 0) {
      const ok = confirm('Des matchs de phase finale existent déjà. Voulez-vous les remplacer ?');
      if (!ok) return;
      const { error: delErr } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .is('group_id', null);
      if (delErr) { alert(delErr.message); return; }
    }
  }
  // Determine nearest power of 2 and create first round pairings
  const pow2 = 1 << Math.floor(Math.log2(n));
  const firstRound = [];
  for (let i = 0; i < pow2; i += 2) {
    const a = teams[i];
    const b = teams[i + 1];
    if (a && b) {
      firstRound.push({
        tournament_id: tournamentId,
        round: '1/8 ou 1er tour',
        home_team_id: a.id,
        away_team_id: b.id,
        status: 'scheduled',
      });
    }
  }
  if (!firstRound.length) { alert('Impossible de générer le bracket.'); return; }
  const { error: insErr } = await supabase.from('matches').insert(firstRound);
  if (insErr) { alert(insErr.message); return; }
  try {
    window.showToast && window.showToast('Bracket généré', {
      type: 'success',
      actionLabel: 'Voir les matchs',
      onAction: () => scrollToMatches(),
    });
  } catch {}
  await renderMatchesByGroup(tournamentId);
}

// Render groups summary block at the top of the Programme des rencontres page
async function renderGroups(tournamentId) {
  const host = document.getElementById('groups-summary');
  if (!host) return;
  host.innerHTML = '';
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });
  if (gErr) { host.innerHTML = `<div class="text-red-600">${gErr.message}</div>`; return; }
  if (!groups?.length) { host.innerHTML = ''; return; }
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, group_id')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });
  const byGroup = Object.fromEntries((groups||[]).map(g => [g.id, []]));
  (teams||[]).forEach(tm => { if (byGroup[tm.group_id]) byGroup[tm.group_id].push(tm); });
  host.innerHTML = groups.map(g => `
    <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
      <div class="font-semibold">Poule ${g.name}</div>
      <ul class="mt-2 space-y-1 text-sm">
        ${(byGroup[g.id]||[]).map(tm => `<li>• ${tm.name}</li>`).join('') || '<li class="opacity-70">(aucune équipe)</li>'}
      </ul>
    </div>
  `).join('');
}
