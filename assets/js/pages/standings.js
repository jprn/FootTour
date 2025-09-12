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
  // Calcul du classement à l'ouverture de la page uniquement
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
      .eq('tournament_id', tournamentId)
      .in('status', ['live','finished']),
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

  // If tournament is groups_knockout and ALL matches (of the tournament) are finished, show CTA to generate knockout
  const isGroupsFormat = (tinfo?.format || 'groups_knockout') === 'groups_knockout';
  const [{ count: totalMatches }, { count: finishedMatches }] = await Promise.all([
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('tournament_id', tournamentId),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('tournament_id', tournamentId).eq('status', 'finished'),
  ]);
  const allFinished = (totalMatches ?? 0) > 0 && (finishedMatches ?? 0) === (totalMatches ?? 0);
  const remaining = Math.max(0, (totalMatches ?? 0) - (finishedMatches ?? 0));
  if (isGroupsFormat && allFinished) {
    const ctaHost = document.getElementById('ko-cta');
    if (ctaHost) {
      ctaHost.classList.remove('hidden');
      ctaHost.innerHTML = `<button id=\"gen-ko\" class=\"px-3 py-2 rounded-2xl bg-primary text-white\">Lancer les phases finales</button>`;
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
  } else if (isGroupsFormat && (totalMatches ?? 0) > 0) {
    const ctaHost = document.getElementById('ko-cta');
    if (ctaHost) {
      ctaHost.classList.remove('hidden');
      ctaHost.innerHTML = `
        <span class=\"text-sm px-3 py-2 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200\">
          ${remaining} match(s) restant(s) à clôturer avant de lancer la phase finale — 
          <a href=\"#/app/t/${tournamentId}/matches\" class=\"underline\">ouvrir les matchs</a>
        </span>
      `;
    }
  }

  // If a knockout phase already exists but no Final yet, and the last KO round is fully finished with exactly 2 winners, offer CTA to generate the Final
  const { data: koAll } = await supabase
    .from('matches')
    .select('id, round, status, home_team_id, away_team_id, home_score, away_score, home:home_team_id(name), away:away_team_id(name)')
    .eq('tournament_id', tournamentId)
    .is('group_id', null);
  const hasKO = Array.isArray(koAll) && koAll.length > 0;
  if (hasKO) {
    const hasFinal = (koAll||[]).some(m => String(m.round||'').toLowerCase().includes('finale') && !String(m.round||'').toLowerCase().includes('demi'));
    if (!hasFinal) {
      const finishedKo = (koAll||[]).filter(m => m.status === 'finished');
      // Build per-round counts (exclude Final)
      const perRound = {};
      finishedKo.forEach(m => {
        const r = String(m.round||'');
        if (r.toLowerCase().includes('finale') && !r.toLowerCase().includes('demi')) return;
        perRound[r] = (perRound[r]||0) + 1;
      });
      const rounds = Object.entries(perRound).filter(([,c]) => c > 0);
      if (rounds.length) {
        // choose the smallest round by match count (>1 preferred for semis). If multiple, pick the one with count == 2; else min count.
        const two = rounds.find(([,c]) => c === 2);
        const targetRound = two ? two[0] : rounds.sort((a,b) => a[1]-b[1])[0][0];
        const targetMatches = finishedKo.filter(m => String(m.round||'') === targetRound);
        // Compute winners and losers from target round
        const winners = [];
        const losers = [];
        for (const m of targetMatches) {
          const hs = Number(m.home_score);
          const as = Number(m.away_score);
          if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
          if (hs > as) { winners.push({ id: m.home_team_id }); losers.push({ id: m.away_team_id }); }
          else if (as > hs) { winners.push({ id: m.away_team_id }); losers.push({ id: m.home_team_id }); }
        }
        if (winners.length === 2) {
          const ctaHost = document.getElementById('ko-cta');
          if (ctaHost) {
            ctaHost.classList.remove('hidden');
            // Politique demandée:
            // 1) Après le premier tour KO terminé: afficher UNIQUEMENT "Générer la petite finale" (si pas encore créée)
            // 2) Quand la petite finale est terminée: afficher UNIQUEMENT "Générer la finale"
            const hasPetiteFinale = (koAll||[]).some(m => /petite/i.test(String(m.round||'')));
            const petiteFinaleFinished = (koAll||[]).some(m => /petite/i.test(String(m.round||'')) && m.status === 'finished');

            // Décider quel bouton afficher
            let html = '';
            if (!hasPetiteFinale && losers.length === 2) {
              // Étape 1: proposer la petite finale seulement
              html = `<button id=\"gen-small-final\" class=\"px-3 py-2 rounded-2xl bg-primary text-white\">Générer la petite finale</button>`;
            } else if (petiteFinaleFinished) {
              // Étape 2: petite finale terminée -> proposer la finale seulement
              html = `<button id=\"gen-final\" class=\"px-3 py-2 rounded-2xl bg-primary text-white\">Générer la finale</button>`;
            } else {
              // Sinon, ne rien proposer (ou afficher un bouton désactivé si souhaité)
              html = '';
            }
            ctaHost.innerHTML = html;

            // Bind actions selon le bouton visible
            document.getElementById('gen-small-final')?.addEventListener('click', async () => {
              const toInsert = [{
                tournament_id: tournamentId,
                round: 'Petite finale',
                home_team_id: losers[0].id,
                away_team_id: losers[1].id,
                status: 'scheduled',
              }];
              const { error } = await supabase.from('matches').insert(toInsert);
              if (error) { alert(error.message); return; }
              try { window.showToast && window.showToast('Petite finale générée', { type: 'success' }); } catch {}
              location.hash = `#/app/t/${tournamentId}/matches`;
            });

            document.getElementById('gen-final')?.addEventListener('click', async () => {
              const toInsert = [{
                tournament_id: tournamentId,
                round: 'Finale',
                home_team_id: winners[0].id,
                away_team_id: winners[1].id,
                status: 'scheduled',
              }];
              const { error } = await supabase.from('matches').insert(toInsert);
              if (error) { alert(error.message); return; }
              try { window.showToast && window.showToast('Finale générée', { type: 'success' }); } catch {}
              location.hash = `#/app/t/${tournamentId}/matches`;
            });
          }
        }
      }
    }
    // Render bracket view cards for KO rounds
    try {
      const bracketHost = document.createElement('div');
      bracketHost.className = 'space-y-4';
      const title = document.createElement('h2');
      title.className = 'text-xl font-semibold mt-6';
      title.textContent = 'Phase finale';
      host.parentElement?.insertBefore(title, host.nextSibling);
      host.parentElement?.insertBefore(bracketHost, title.nextSibling);

      const roundsMap = {};
      (koAll||[]).forEach(m => {
        const r = String(m.round || 'Phase finale');
        roundsMap[r] = roundsMap[r] || [];
        roundsMap[r].push(m);
      });
      const order = Object.keys(roundsMap).sort((a,b) => rankRound(a) - rankRound(b));
      bracketHost.innerHTML = order.map(r => `
        <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
          <div class="font-semibold">${r}</div>
          <div class="mt-2 grid md:grid-cols-2 gap-3">
            ${(roundsMap[r]||[]).map(m => `
              <div class="text-sm p-2 rounded-xl border border-gray-200/80 dark:border-white/10">
                <div class="flex items-center justify-between">
                  <span>${m.home?.name || '—'}</span>
                  <span class="font-semibold">${fmtScore(m.home_score, m.away_score)}</span>
                  <span>${m.away?.name || '—'}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">${LabelStatus(m.status)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');

      // Final ranking if Final (and Small Final if exists) are finished
      const finalMatch = (koAll||[]).find(m => /finale/i.test(String(m.round||'')) && !/petite/i.test(String(m.round||'')));
      const smallFinal = (koAll||[]).find(m => /petite/i.test(String(m.round||'')));
      if (finalMatch?.status === 'finished') {
        const rank = [];
        const fhs = toNum(finalMatch.home_score);
        const fas = toNum(finalMatch.away_score);
        if (fhs != null && fas != null) {
          const finalWinner = fhs > fas ? { id: finalMatch.home_team_id, name: finalMatch.home?.name } : { id: finalMatch.away_team_id, name: finalMatch.away?.name };
          const finalLoser = fhs > fas ? { id: finalMatch.away_team_id, name: finalMatch.away?.name } : { id: finalMatch.home_team_id, name: finalMatch.home?.name };
          rank.push({ pos: 1, name: finalWinner.name });
          rank.push({ pos: 2, name: finalLoser.name });
          if (smallFinal?.status === 'finished') {
            const shs = toNum(smallFinal.home_score);
            const sas = toNum(smallFinal.away_score);
            if (shs != null && sas != null) {
              const smallWinner = shs > sas ? { name: smallFinal.home?.name } : { name: smallFinal.away?.name };
              const smallLoser = shs > sas ? { name: smallFinal.away?.name } : { name: smallFinal.home?.name };
              rank.push({ pos: 3, name: smallWinner.name });
              rank.push({ pos: 4, name: smallLoser.name });
            }
          }
        }
        if (rank.length) {
          const card = document.createElement('div');
          card.className = 'mt-4 p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5';
          card.innerHTML = `
            <div class="font-semibold">Classement final</div>
            <ol class="mt-2 space-y-1 text-sm">
              ${rank.map(r => `<li><span class="font-semibold">${r.pos}.</span> ${r.name}</li>`).join('')}
            </ol>
          `;
          bracketHost.parentElement?.insertBefore(card, bracketHost.nextSibling);
        }
      }
    } catch {}
  }

// Helpers for KO rendering
function rankRound(label) {
  const s = String(label||'').toLowerCase();
  if (s.includes('1/8')) return 1;
  if (s.includes('1/4')) return 2;
  if (s.includes('demi')) return 3;
  if (s.includes('petite')) return 4;
  if (s.includes('finale')) return 5;
  return 99;
}

function fmtScore(h,a) {
  const hs = toNum(h); const as = toNum(a);
  if (hs == null || as == null) return '—';
  return `${hs} - ${as}`;
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
