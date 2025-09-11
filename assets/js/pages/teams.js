import { supabase } from '../supabaseClient.js';

export default function TeamsPage({ id }) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <a href="#/app/t/${id}" class="text-sm text-gray-500">← Tableau de bord</a>
        <h1 class="text-2xl font-semibold mt-1">Équipes</h1>
      </div>
      <button id="add-team" class="px-3 py-2 rounded-2xl bg-primary text-white">Ajouter une équipe</button>
    </div>

    <section id="teams-list" class="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></section>

    <dialog id="team-modal" class="backdrop:bg-black/30 rounded-2xl p-0">
      <form method="dialog" id="team-form" class="p-6 w-[28rem] max-w-[95vw] bg-white dark:bg-dark rounded-2xl border border-gray-200/80 dark:border-white/10">
        <h2 class="text-xl font-semibold">Nouvelle équipe</h2>
        <div class="mt-4 space-y-3">
          <input required name="name" placeholder="Nom de l\'équipe" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
          <input name="logo_url" placeholder="URL du logo (optionnel)" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        </div>
        <div class="mt-4 text-right">
          <button value="cancel" class="px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20">Annuler</button>
          <button id="create-team" class="px-3 py-2 rounded-xl bg-primary text-white">Ajouter</button>
        </div>
      </form>
    </dialog>
  `;
}

export function onMountTeams({ id }) {
  const modal = document.getElementById('team-modal');
  // Ensure cancel button works reliably
  document.querySelector('#team-modal [value="cancel"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    modal.close();
  });

  // Check plan and team count before allowing creation (Free: max 8 équipes)
  document.getElementById('add-team')?.addEventListener('click', async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) { alert('Veuillez vous connecter.'); return; }
    const uid = session.session.user.id;

    const [{ data: prof }, { count }] = await Promise.all([
      supabase.from('profiles').select('plan').eq('id', uid).single(),
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('tournament_id', id),
    ]);
    const plan = prof?.plan || 'free';
    if (plan === 'free' && (count ?? 0) >= 8) {
      try { window.showToast && window.showToast('Limite Free atteinte — 8 équipes max par tournoi. Passez en Pro pour plus.', { type: 'error' }); } catch {}
      location.hash = '#/billing/checkout?plan=pro';
      return;
    }
    modal.showModal();
  });

  document.getElementById('create-team')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const form = document.getElementById('team-form');
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    const { data, error } = await supabase.from('teams').insert({
      tournament_id: id,
      name: body.name,
      logo_url: body.logo_url || null,
    }).select('id');
    if (error) { alert(error.message); return; }
    modal.close();
    try { window.showToast && window.showToast('Équipe ajoutée', { type: 'success' }); } catch {}
    const newId = data?.[0]?.id;
    loadTeams(id, { highlightId: newId });
  });

  loadTeams(id);
}

async function loadTeams(id, { highlightId } = {}) {
  const list = document.getElementById('teams-list');
  list.innerHTML = '<div class="col-span-full text-sm opacity-70">Chargement...</div>';
  const { data, error } = await supabase.from('teams').select('*').eq('tournament_id', id).order('created_at', { ascending: true });
  if (error) { list.innerHTML = `<div class=\"text-red-600\">${error.message}</div>`; return; }
  if (!data?.length) { list.innerHTML = '<div class="opacity-70">Aucune équipe.</div>'; return; }
  list.innerHTML = data.map(t => `
    <div class="p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 flex items-center gap-3 transition-all" data-team-id="${t.id}" id="team-${t.id}">
      ${t.logo_url ? `<img src="${t.logo_url}" class="w-10 h-10 rounded-xl object-cover" alt="logo" />` : `<div class="w-10 h-10 rounded-xl bg-gray-200 dark:bg-white/10 grid place-items-center">${t.name[0]}</div>`}
      <div class="font-medium">${t.name}</div>
    </div>
  `).join('');

  if (highlightId) {
    const el = document.getElementById(`team-${highlightId}`);
    if (el) {
      el.classList.add('ring-2','ring-primary','animate-pulse');
      setTimeout(() => {
        el.classList.remove('animate-pulse');
        setTimeout(() => {
          el.classList.remove('ring-2','ring-primary');
        }, 600);
      }, 1200);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
