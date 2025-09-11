import { supabase } from '../supabaseClient.js';

export default function TournamentsPage() {
  return `
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Mes tournois</h1>
        <div id="quota-banner" class="hidden opacity-0 mt-2 text-sm px-3 py-2 rounded-2xl border border-primary/30 bg-primary/5 text-primary transition-all duration-300">
          Limite du plan Free atteinte. <a href="#/billing/checkout?plan=pro" class="underline font-medium">Passer en Pro</a> pour créer d'autres tournois.
        </div>
        <div class="mt-1 text-sm text-gray-500 flex items-center gap-2">
          <span id="quota-indicator" class="px-2 py-1 rounded-xl border border-gray-300 dark:border-white/20">—</span>
        </div>
      </div>
      <button id="new-tournament-btn" class="px-3 py-2 rounded-2xl bg-primary text-white">Nouveau tournoi</button>
    </div>

    <section id="tournaments-list" class="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></section>

    ${CreateTournamentModal()}
  `;
}

function CreateTournamentModal() {
  return `
  <dialog id="tournament-modal" class="backdrop:bg-black/40 rounded-2xl p-0">
    <form method="dialog" id="tournament-form" class="p-6 w-[36rem] max-w-[95vw] bg-white dark:bg-dark text-gray-900 dark:text-gray-100 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-soft">
      <h2 class="text-xl font-semibold">Créer un tournoi</h2>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="text-sm">Nom</label>
          <input required name="name" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/60" placeholder="Nom du tournoi" />
        </div>
        <div>
          <label class="text-sm">Discipline</label>
          <select name="sport" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent">
            <option>football</option>
            <option>basketball</option>
            <option>handball</option>
            <option>volley</option>
            <option>futsal</option>
          </select>
        </div>
        <div>
          <label class="text-sm">Lieu</label>
          <input name="location" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/60" placeholder="Ville / Complexe" />
        </div>
        <div>
          <label class="text-sm">Dates</label>
          <input name="dates" placeholder="2025-09-20 → 2025-09-21" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/60" />
        </div>
        <div>
          <label class="text-sm">Format</label>
          <select name="format" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/60">
            <option value="groups_knockout">Poules + Phase finale</option>
            <option value="knockout">Élimination directe</option>
          </select>
        </div>
        <div>
          <label class="text-sm">Points (V/N/D)</label>
          <input name="points" value="3/1/0" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/60" placeholder="3/1/0" />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button value="cancel" class="px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10">Annuler</button>
        <button id="create-tournament" class="px-3 py-2 rounded-2xl bg-primary text-white">Créer</button>
      </div>
    </form>
  </dialog>
  `;
}

export function onMountTournaments() {
  const modal = document.getElementById('tournament-modal');
  // Ensure the cancel button closes the modal reliably
  document.querySelector('#tournament-modal [value="cancel"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    modal.close();
  });
  document.getElementById('new-tournament-btn')?.addEventListener('click', async () => {
    // Check plan and tournaments count before allowing creation
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) { alert('Veuillez vous connecter.'); return; }
    const uid = session.session.user.id;

    // Read profile plan
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', uid)
      .single();
    if (profileErr) { console.warn(profileErr); modal.showModal(); return; }

    // Count existing tournaments for this user
    const { count } = await supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('owner', uid);

    if ((profile?.plan ?? 'free') === 'free' && (count ?? 0) >= 1) {
      // Show toast + reveal upgrade banner with animation
      try { window.showToast && window.showToast('Limite Free atteinte — passez en Pro pour créer plus de tournois.', { type: 'error' }); } catch {}
      const banner = document.getElementById('quota-banner');
      if (banner) {
        banner.classList.remove('hidden');
        requestAnimationFrame(() => banner.classList.remove('opacity-0'));
      }
      return;
    }

    modal.showModal();
  });

  document.getElementById('create-tournament')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const form = document.getElementById('tournament-form');
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) { alert('Connectez-vous.'); return; }

    const points = String(body.points || '3/1/0').split('/').map(Number);
    const payload = {
      name: body.name,
      sport: body.sport,
      location: body.location || null,
      dates: body.dates || null,
      format: body.format,
      points_win: points[0] ?? 3,
      points_draw: points[1] ?? 1,
      points_loss: points[2] ?? 0,
    };

    const { data, error } = await supabase.from('tournaments').insert(payload).select('id');
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const looksLikeRls = msg.includes('row-level security') || msg.includes('policy') || msg.includes('permission denied');
      if (looksLikeRls) {
        // toast + show banner with animation
        try { window.showToast && window.showToast('Limite Free atteinte — passez en Pro pour créer plus de tournois.', { type: 'error' }); } catch {}
        const banner = document.getElementById('quota-banner');
        if (banner) {
          banner.classList.remove('hidden');
          requestAnimationFrame(() => banner.classList.remove('opacity-0'));
        }
      } else {
        alert(error.message);
      }
      return;
    }
    // Success: toast then navigate to dashboard of the new tournament
    const newId = data[0].id;
    try { window.showToast && window.showToast('Tournoi créé avec succès', { type: 'success' }); } catch {}
    // Pass context to the dashboard to animate
    try { sessionStorage.setItem('justCreatedTournamentId', newId); } catch {}
    modal.close();
    location.hash = `#/app/t/${newId}`;
  });

  loadTournaments();
  updateQuotaIndicator();
  // Refresh quota when plan/profile updates
  window.addEventListener('profile:updated', updateQuotaIndicator);
}

async function loadTournaments() {
  const list = document.getElementById('tournaments-list');
  list.innerHTML = '<div class="col-span-full text-sm opacity-70">Chargement...</div>';
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) { list.innerHTML = '<div>Veuillez vous connecter.</div>'; return; }

  const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
  if (error) { list.innerHTML = `<div class="text-red-600">${error.message}</div>`; return; }

  if (!data?.length) {
    list.innerHTML = '<div class="opacity-70">Aucun tournoi pour l\'instant.</div>';
    return;
  }

  list.innerHTML = data.map(t => `
    <div class="relative group">
      <a href="#/app/t/${t.id}" class="block p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:shadow-soft transition">
        <div class="text-sm uppercase tracking-wide text-gray-500">${t.sport}</div>
        <div class="mt-1 font-semibold">${t.name}</div>
        <div class="text-sm text-gray-500">${t.location || ''} ${t.dates ? '· ' + t.dates : ''}</div>
      </a>
      <button title="Supprimer" data-action="delete-tournament" data-id="${t.id}"
        class="opacity-0 group-hover:opacity-100 transition absolute top-2 right-2 px-2 py-1 rounded-xl border border-red-300 text-red-600 bg-white/80 dark:bg-white/10 dark:border-red-400 text-xs">
        Supprimer
      </button>
    </div>
  `).join('');

  // Delete handler (event delegation)
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete-tournament"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute('data-id');
    const ok = confirm('Confirmer la suppression de ce tournoi ? Cette action est irréversible.');
    if (!ok) return;
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    try { window.showToast && window.showToast('Tournoi supprimé', { type: 'success' }); } catch {}
    await loadTournaments();
    updateQuotaIndicator();
  }, { once: false });
}

async function updateQuotaIndicator() {
  const badge = document.getElementById('quota-indicator');
  const banner = document.getElementById('quota-banner');
  if (!badge) return;
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) { badge.textContent = 'Non connecté'; return; }
  const uid = session.session.user.id;
  const [{ data: prof }, { count }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', uid).single(),
    supabase.from('tournaments').select('id', { count: 'exact', head: true }).eq('owner', uid),
  ]);
  const plan = prof?.plan || 'free';
  if (plan === 'free') {
    badge.textContent = `Free — ${Math.min(count ?? 0, 1)}/1 tournoi`;
    if ((count ?? 0) < 1 && banner) {
      // hide banner if no longer at limit
      banner.classList.add('opacity-0');
      setTimeout(() => banner.classList.add('hidden'), 200);
    }
  } else if (plan === 'pro' || plan === 'club') {
    badge.textContent = `${plan.toUpperCase()} — illimité`;
    if (banner) {
      banner.classList.add('opacity-0');
      setTimeout(() => banner.classList.add('hidden'), 200);
    }
  } else {
    badge.textContent = `${plan.toUpperCase()} — illimité`;
    if (banner) {
      banner.classList.add('opacity-0');
      setTimeout(() => banner.classList.add('hidden'), 200);
    }
  }
}
