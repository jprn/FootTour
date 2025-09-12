import { supabase } from '../supabaseClient.js';

export default function StandingsPage({ id }) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <a href="#/app/t/${id}" class="text-sm text-gray-500">← Tableau de bord</a>
        <h1 class="text-2xl font-semibold mt-1">Classement</h1>
      </div>
      <div class="flex gap-2 items-center">
        <div id="ko-cta" class="hidden"></div>
        <a href="#/app/t/${id}/schedule" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Planning</a>
        <a href="#/app/t/${id}/matches" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Matchs</a>
      </div>
    </div>

    <section class="mt-6 space-y-6">
      <div id="standings-content" class="grid md:grid-cols-2 gap-4"></div>
    </section>
  `;
}

function computeRoundLabel(n) {
  if (n >= 16) return '1/8 de finale';
  if (n >= 8) return '1/4 de finale';
  if (n >= 4) return 'Demi-finale';
  if (n === 2) return 'Finale';
  return 'Phase finale';
}

async function generateKnockoutFromStandings(tournamentId, groups, perGroupTables, kPerGroup = 2) {
  // Collect top K teams per group
  const qualifiersPerGroup = groups.map(g => (perGroupTables[g.id] || []).slice(0, kPerGroup));
  const total = qualifiersPerGroup.reduce((acc, arr) => acc + arr.length, 0);
  if (total < 2) { alert('Pas assez d\'équipes qualifiées.'); return; }

  // Global seeding: interleave by rank position across groups
  // Seeds: [A1,B1,C1,..., A2,B2,C2,..., A3,...]
  const seeds = [];
  for (let r = 0; r < kPerGroup; r++) {
    for (let gi = 0; gi < groups.length; gi++) {
      const teamRow = qualifiersPerGroup[gi][r];
      if (teamRow) seeds.push(teamRow);
    }
  }
  // Pair 1 vs last, 2 vs last-1, ...
  const pairs = [];
  for (let i = 0; i < Math.floor(seeds.length / 2); i++) {
    const h = seeds[i];
    const a = seeds[seeds.length - 1 - i];
    pairs.push([h, a]);
  }

  const roundLabel = computeRoundLabel(seeds.length);
  const toInsert = pairs.map(([h, a]) => ({
    tournament_id: tournamentId,
    round: roundLabel,
    home_team_id: h.id,
    away_team_id: a.id,
    status: 'scheduled',
  }));

  if (!toInsert.length) { alert('Aucune rencontre à générer pour la phase finale.'); return; }
  // Confirm summary before inserting
  const summary = pairs.map(([h,a]) => `${h.rank ? `#${h.rank} ` : ''}${h.name} vs ${a.rank ? `#${a.rank} ` : ''}${a.name}`).join('\n');
  const ok = confirm(`Confirmer la génération de la phase finale (${roundLabel}) avec ${pairs.length} matchs:\n\n${summary}`);
  if (!ok) return;
  const { error } = await supabase.from('matches').insert(toInsert);
  if (error) { alert(error.message); return; }
  try { window.showToast && window.showToast('Phase finale générée', { type: 'success' }); } catch {}
  location.hash = `#/app/t/${tournamentId}/schedule`;
}

export function onMountStandings({ id }) {
  renderStandings(id);
}

async function renderStandings(tournamentId) {
  const host = document.getElementById('standings-content');
  host.innerHTML = '<div class="col-span-full text-sm opacity-70">Chargement…</div>';

  // Load tournament for points settings
  const { data: t } = await supabase.from('tournaments').select('points_win, points_draw, points_loss').eq('id', tournamentId).single();
  const PTS_W = t?.points_win ?? 3;
  const PTS_D = t?.points_draw ?? 1;
  const PTS_L = t?.points_loss ?? 0;

  const [{ data: groups }, { data: teams }, { data: matches }, { data: tinfo }] = await Promise.all([
    supabase.from('groups').select('id, name').eq('tournament_id', tournamentId).order('name', { ascending: true }),
    supabase.from('teams').select('id, name, group_id').eq('tournament_id', tournamentId).order('name', { ascending: true }),
    supabase
      .from('matches')
      .select('id, group_id, status, home_team_id, away_team_id, home_score, away_score')
      .eq('tournament_id', tournamentId),
    supabase.from('tournaments').select('format').eq('id', tournamentId).single(),
  ]);

  if (!groups?.length) { host.innerHTML = '<div class="col-span-full opacity-70">Aucune poule.</div>'; return; }

  const byGroupTeams = Object.fromEntries(groups.map(g => [g.id, []]));
  (teams||[]).forEach(tm => { if (byGroupTeams[tm.group_id]) byGroupTeams[tm.group_id].push(tm); });

  const byGroupMatches = Object.fromEntries(groups.map(g => [g.id, []]));
  (matches||[]).forEach(m => { if (byGroupMatches[m.group_id]) byGroupMatches[m.group_id].push(m); });

  const perGroupTables = {};
  const cards = groups.map(g => {
    const table = computeStandings(byGroupTeams[g.id] || [], byGroupMatches[g.id] || [], { PTS_W, PTS_D, PTS_L });
    perGroupTables[g.id] = table;
    return StandingsCard(g.name, table);
  }).join('');

  host.innerHTML = cards;

  // If tournament is groups_knockout and all group matches are finished, show CTA to generate knockout
  const allGroupMatches = (matches||[]).filter(m => m.group_id);
  const allFinished = allGroupMatches.length > 0 && allGroupMatches.every(m => m.status === 'finished');
  const isGroupsFormat = (tinfo?.format || 'groups_knockout') === 'groups_knockout';
  if (isGroupsFormat && allFinished) {
    const ctaHost = document.getElementById('ko-cta');
    if (ctaHost) {
      ctaHost.classList.remove('hidden');
      ctaHost.innerHTML = `<button id="gen-ko" class="px-3 py-2 rounded-2xl bg-primary text-white">Lancer les phases finales</button>`;
      document.getElementById('gen-ko')?.addEventListener('click', async () => {
        // Determine how many can qualify per group (2 or 4) depending on group sizes
        const groupSizes = groups.map(g => (perGroupTables[g.id] || []).length);
        const minSize = Math.min(...groupSizes);
        const options = [2, 4].filter(k => k <= minSize);
        if (!options.length) { alert('Groupes trop petits pour générer une phase finale.'); return; }
        const defaultK = options.includes(2) ? 2 : options[0];
        let k = parseInt(prompt(`Nombre de qualifiés par poule (${options.join(' ou ')})`, String(defaultK)) || '0', 10);
        if (!options.includes(k)) { alert('Nombre de qualifiés invalide.'); return; }
        await generateKnockoutFromStandings(tournamentId, groups, perGroupTables, k);
      });
    }
  }
}

function computeStandings(teams, matches, { PTS_W, PTS_D, PTS_L }) {
  const row = Object.fromEntries(teams.map(t => [t.id, initRow(t)]));

  for (const m of matches) {
    // Ignorer les matchs sans scores
    const hs = toNum(m.home_score);
    const as = toNum(m.away_score);
    if (hs == null || as == null) continue;

    const home = row[m.home_team_id];
    const away = row[m.away_team_id];
    if (!home || !away) continue;

    home.p++; away.p++;
    home.gf += hs; home.ga += as; home.gd = home.gf - home.ga;
    away.gf += as; away.ga += hs; away.gd = away.gf - away.ga;

    if (hs > as) { home.w++; away.l++; home.pts += PTS_W; away.pts += PTS_L; }
    else if (hs < as) { away.w++; home.l++; away.pts += PTS_W; home.pts += PTS_L; }
    else { home.d++; away.d++; home.pts += PTS_D; away.pts += PTS_D; }
  }

  const rows = Object.values(row);
  rows.sort((a,b) => (
    b.pts - a.pts ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name)
  ));
  // Ajouter un rang
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

function initRow(team) {
  return { id: team.id, name: team.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, rank: 0 };
}

function toNum(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }

function StandingsCard(groupName, rows) {
  return `
    <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 overflow-auto">
      <div class="font-semibold">Poule ${groupName}</div>
      <table class="mt-2 w-full text-sm whitespace-nowrap">
        <thead class="text-gray-500">
          <tr>
            <th class="text-left px-2">#</th>
            <th class="text-left px-2">Équipe</th>
            <th class="text-center px-2">J</th>
            <th class="text-center px-2">G</th>
            <th class="text-center px-2">N</th>
            <th class="text-center px-2">D</th>
            <th class="text-center px-2">BP</th>
            <th class="text-center px-2">BC</th>
            <th class="text-center px-2">+/-</th>
            <th class="text-center px-2">PTS</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="px-2">${r.rank}</td>
              <td class="px-2">${r.name}</td>
              <td class="text-center px-2">${r.p}</td>
              <td class="text-center px-2">${r.w}</td>
              <td class="text-center px-2">${r.d}</td>
              <td class="text-center px-2">${r.l}</td>
              <td class="text-center px-2">${r.gf}</td>
              <td class="text-center px-2">${r.ga}</td>
              <td class="text-center px-2">${r.gd}</td>
              <td class="text-center px-2 font-semibold">${r.pts}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
