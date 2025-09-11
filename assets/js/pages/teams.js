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

    <dialog id="team-modal" class="backdrop:bg-black/40 rounded-2xl p-0">
      <form method="dialog" id="team-form" class="p-6 w-[28rem] max-w-[95vw] bg-white dark:bg-dark text-gray-900 dark:text-gray-100 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-soft">
        <h2 class="text-xl font-semibold">Nouvelle équipe</h2>
        <div class="mt-4 space-y-3">
          <input required name="name" placeholder="Nom de l'équipe" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/60" />
          <input name="logo_url" placeholder="URL du logo (optionnel)" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/60" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button value="cancel" class="px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10">Annuler</button>
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
    const editingId = form.getAttribute('data-edit-id');
    // Decide insert or update
    if (editingId) {
      const { error } = await supabase.from('teams').update({
        name: body.name,
        logo_url: body.logo_url || null,
      }).eq('id', editingId);
      if (error) { alert(error.message); return; }
      form.removeAttribute('data-edit-id');
      modal.close();
      try { window.showToast && window.showToast('Équipe mise à jour', { type: 'success' }); } catch {}
      loadTeams(id, { highlightId: editingId });
      return;
    }

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
    <div class="relative p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 flex items-center gap-3 transition-all group" data-team-id="${t.id}" id="team-${t.id}">
      ${t.logo_url ? `<img src="${t.logo_url}" class="w-10 h-10 rounded-xl object-cover" alt="logo" />` : `<div class=\"w-10 h-10 rounded-xl bg-gray-200 dark:bg-white/10 grid place-items-center\">${t.name[0]}</div>`}
      <div class="font-medium flex-1">${t.name}</div>
      <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
        <button title="Modifier" data-action="edit-team" data-id="${t.id}" class="w-8 h-8 grid place-items-center rounded-xl border border-gray-300 dark:border-white/20 text-xs">✏️</button>
        <button title="Supprimer" data-action="delete-team" data-id="${t.id}" class="w-8 h-8 grid place-items-center rounded-xl border border-red-300 dark:border-red-400 text-red-600 text-xs">🗑️</button>
      </div>
    </div>
  `).join('');

  // Event delegation for edit/delete
  list.onclick = async (e) => {
    const editBtn = e.target.closest('[data-action="edit-team"]');
    const delBtn = e.target.closest('[data-action="delete-team"]');
    if (editBtn) {
      const teamId = editBtn.getAttribute('data-id');
      const { data: team, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
      if (error) { alert(error.message); return; }
      const modal = document.getElementById('team-modal');
      const form = document.getElementById('team-form');
      form.setAttribute('data-edit-id', teamId);
      form.querySelector('[name="name"]').value = team.name || '';
      form.querySelector('[name="logo_url"]').value = team.logo_url || '';
      modal.showModal();
      return;
    }
    if (delBtn) {
      const teamId = delBtn.getAttribute('data-id');
      const ok = confirm('Confirmer la suppression de cette équipe ?');
      if (!ok) return;
      // Fetch team before delete for potential undo
      const { data: toRestore } = await supabase.from('teams').select('*').eq('id', teamId).single();
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) { alert(error.message); return; }
      try {
        window.showToast && window.showToast('Équipe supprimée', {
          type: 'success',
          actionLabel: 'Annuler',
          onAction: async () => {
            if (!toRestore) return;
            // Try to reinsert with same id; if conflict, insert without id
            let insErr = null;
            const payload = { id: toRestore.id, tournament_id: toRestore.tournament_id, group_id: toRestore.group_id, name: toRestore.name, logo_url: toRestore.logo_url };
            let res = await supabase.from('teams').insert(payload);
            if (res.error) {
              const { error: err2 } = await supabase.from('teams').insert({ tournament_id: toRestore.tournament_id, group_id: toRestore.group_id, name: toRestore.name, logo_url: toRestore.logo_url });
              insErr = err2;
            }
            if (insErr) { alert(insErr.message); }
            loadTeams(id);
          }
        });
      } catch {}
      loadTeams(id);
      return;
    }
  };

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
