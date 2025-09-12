import { supabase } from '../supabaseClient.js';

export default function MatchesPage({ id }) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <a href="#/app/t/${id}" class="text-sm text-gray-500">← Tableau de bord</a>
        <h1 class="text-2xl font-semibold mt-1">Matchs</h1>
      </div>
      <div class="flex gap-2">
        <a href="#/app/t/${id}/standings" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Classement</a>
        <a href="#/app/t/${id}/schedule" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Planning</a>
      </div>
    </div>

    <section class="mt-6 space-y-6">
      <div id="matches-filters" class="flex flex-wrap items-center gap-2 text-sm">
        <button data-filter="all" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20">Tous</button>
        <button data-filter="scheduled" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20">À venir</button>
        <button data-filter="live" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20">En direct</button>
        <button data-filter="finished" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20">Terminés</button>
        <span class="mx-2 opacity-50">|</span>
        <label for="team-filter" class="opacity-70">Équipe</label>
        <select id="team-filter" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent">
          <option value="">Toutes</option>
        </select>
      </div>

      <div id="matches-list" class="grid md:grid-cols-2 gap-4"></div>
    </section>
  `;
}

export function onMountMatches({ id }) {
  init(id);
}

async function init(tournamentId) {
  setupFilterHandlers(tournamentId);
  await populateTeams(tournamentId);
  await renderMatches(tournamentId);
}

function setupFilterHandlers(tournamentId) {
  const wrap = document.getElementById('matches-filters');
  if (!wrap) return;
  // Keep current filters state
  let currentStatus = null;
  let currentTeamId = '';
  wrap.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const value = btn.getAttribute('data-filter');
    currentStatus = (value === 'all') ? null : value;
    currentTeamId = document.getElementById('team-filter')?.value || '';
    await renderMatches(tournamentId, { status: currentStatus, teamId: currentTeamId || null });
  }, { once: false });

  document.getElementById('team-filter')?.addEventListener('change', async (e) => {
    currentTeamId = e.target.value || '';
    await renderMatches(tournamentId, { status: currentStatus, teamId: currentTeamId || null });
  });
}

async function populateTeams(tournamentId) {
  const sel = document.getElementById('team-filter');
  if (!sel) return;
  const { data, error } = await supabase
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });
  if (error) return;
  sel.innerHTML = '<option value="">Toutes</option>' +
    (data || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

async function renderMatches(tournamentId, { status = null, teamId = null } = {}) {
  const list = document.getElementById('matches-list');
  list.innerHTML = '<div class="col-span-full text-sm opacity-70">Chargement…</div>';

  let query = supabase
    .from('matches')
    .select('id, group_id, round, start_time, status, home_score, away_score, home:home_team_id(name), away:away_team_id(name)')
    .eq('tournament_id', tournamentId)
    .order('start_time', { ascending: true, nullsFirst: true });
  if (status) query = query.eq('status', status);
  if (teamId) query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<div class="text-red-600">${error.message}</div>`; return; }
  if (!data?.length) { list.innerHTML = '<div class="opacity-70">Aucun match.</div>'; return; }

  // Detect if a knockout phase exists (any match without group_id and round including 'finale')
  const hasKnockout = (data || []).some(m => !m.group_id);

  list.innerHTML = data.map(m => MatchCard(m, { lockGroup: hasKnockout && !!m.group_id })).join('');

  // Event delegation for inline updates (auto-save)
  list.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-match-id]');
    if (!row) return;
    const id = row.getAttribute('data-match-id');

    if (e.target.matches('[data-action="status"]')) {
      const next = e.target.getAttribute('data-value');
      const disabled = e.target.hasAttribute('disabled');
      if (disabled) return;
      // Persist and update badge immediately
      await saveRow(row, id, { statusOnly: true, setStatus: next });
      const badgeHost = row.querySelector('[data-role="status-badge"]');
      if (badgeHost) {
        badgeHost.innerHTML = StatusBadge(next);
      }
      return;
    }

    // Score increment/decrement
    const incBtn = e.target.closest('[data-action="inc"]');
    const decBtn = e.target.closest('[data-action="dec"]');
    if (incBtn || decBtn) {
      const side = (incBtn || decBtn).getAttribute('data-side'); // 'home' | 'away'
      const input = row.querySelector(`[name="${side}_score"]`);
      if (!input || input.disabled) return;
      const cur = Number(input.value || '0');
      const next = incBtn ? (cur + 1) : Math.max(0, cur - 1);
      input.value = String(next);
      await saveRow(row, id, { scoresOnly: true });
      return;
    }
  }, { once: false });

  // Change handlers: manual score inputs -> auto-save
  list.addEventListener('change', async (e) => {
    const row = e.target.closest('[data-match-id]');
    if (!row) return;
    const id = row.getAttribute('data-match-id');
    if (e.target.matches('[name="home_score"], [name="away_score"]')) {
      await saveRow(row, id, { scoresOnly: true });
    }
  });
}

function MatchCard(m, { lockGroup = false } = {}) {
  const statusOptions = ['scheduled','live','finished'];
  const statusBadge = StatusBadge(m.status);
  const disabled = lockGroup ? 'disabled' : '';
  const lockNote = lockGroup ? '<div class="text-xs text-amber-600 mt-1">Verrouillé: la phase finale est lancée</div>' : '';
  return `
    <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5" data-match-id="${m.id}">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-500">${m.round || (m.group_id ? 'Poule' : 'Match')}</div>
        <span data-role="status-badge">${statusBadge}</span>
      </div>
      <div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div class="truncate font-medium">${m.home?.name || '—'}</div>
        <div class="flex items-center gap-2">
          <button type="button" data-action="dec" data-side="home" class="w-8 h-8 grid place-items-center rounded-xl border border-gray-300 dark:border-white/20" ${disabled}>−</button>
          <button type="button" data-action="inc" data-side="home" class="w-8 h-8 grid place-items-center rounded-xl border border-gray-300 dark:border-white/20" ${disabled}>+</button>
          <input ${disabled} inputmode="numeric" name="home_score" value="${m.home_score ?? ''}" class="w-14 text-center px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
          <span class="opacity-60">-</span>
          <input ${disabled} inputmode="numeric" name="away_score" value="${m.away_score ?? ''}" class="w-14 text-center px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
          <button type="button" data-action="dec" data-side="away" class="w-8 h-8 grid place-items-center rounded-xl border border-gray-300 dark:border-white/20" ${disabled}>−</button>
          <button type="button" data-action="inc" data-side="away" class="w-8 h-8 grid place-items-center rounded-xl border border-gray-300 dark:border-white/20" ${disabled}>+</button>
        </div>
        <div class="truncate text-right font-medium">${m.away?.name || '—'}</div>
      </div>
      <div class="mt-3 flex items-center justify-between gap-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="opacity-70">Statut</span>
          <div class="flex items-center gap-1">
            <button type="button" data-action="status" data-value="scheduled" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20" ${disabled}>⏳</button>
            <button type="button" data-action="status" data-value="live" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20" ${disabled}>🔴</button>
            <button type="button" data-action="status" data-value="finished" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20" ${disabled}>✅</button>
          </div>
        </div>
        <div class="flex items-center gap-2"></div>
      </div>
      ${lockNote}
    </div>
  `;
}

function StatusBadge(status) {
  const map = {
    scheduled: 'border-gray-300 text-gray-600',
    live: 'border-red-300 text-red-600',
    finished: 'border-green-300 text-green-700',
  };
  const label = LabelStatus(status);
  const cls = map[status] || map.scheduled;
  return `<span class="px-2 py-0.5 rounded-xl border text-xs ${cls}">${label}</span>`;
}

function LabelStatus(s) {
  if (s === 'live') return 'En direct';
  if (s === 'finished') return 'Terminé';
  return 'Programmé';
}

async function saveRow(row, id, { statusOnly = false, scoresOnly = false, setStatus } = {}) {
  const hs = row.querySelector('[name="home_score"]').value;
  const as = row.querySelector('[name="away_score"]').value;
  const st = setStatus ?? row.querySelector('[name="status"]')?.value ?? null;
  const payload = {};
  if (!statusOnly) {
    payload.home_score = Number.isFinite(Number(hs)) && hs !== '' ? Number(hs) : null;
    payload.away_score = Number.isFinite(Number(as)) && as !== '' ? Number(as) : null;
  }
  if (!scoresOnly) {
    payload.status = (setStatus ?? st ?? 'scheduled');
  }
  const { error } = await supabase.from('matches').update(payload).eq('id', id);
  if (error) { alert(error.message); return; }
  try { window.showToast && window.showToast('Match mis à jour', { type: 'success' }); } catch {}
}
