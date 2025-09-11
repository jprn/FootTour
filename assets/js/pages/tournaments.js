import { supabase } from '../supabaseClient.js';

export default function TournamentsPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Mes tournois</h1>
      <button id="new-tournament-btn" class="px-3 py-2 rounded-2xl bg-primary text-white">Nouveau tournoi</button>
    </div>

    <section id="tournaments-list" class="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></section>

    ${CreateTournamentModal()}
  `;
}

function CreateTournamentModal() {
  return `
  <dialog id="tournament-modal" class="backdrop:bg-black/30 rounded-2xl p-0">
    <form method="dialog" id="tournament-form" class="p-6 w-[36rem] max-w-[95vw] bg-white dark:bg-dark rounded-2xl border border-gray-200/80 dark:border-white/10">
      <h2 class="text-xl font-semibold">Créer un tournoi</h2>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="text-sm">Nom</label>
          <input required name="name" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
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
          <input name="location" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        </div>
        <div>
          <label class="text-sm">Dates</label>
          <input name="dates" placeholder="2025-09-20 → 2025-09-21" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        </div>
        <div>
          <label class="text-sm">Format</label>
          <select name="format" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent">
            <option value="groups_knockout">Poules + Phase finale</option>
            <option value="knockout">Élimination directe</option>
          </select>
        </div>
        <div>
          <label class="text-sm">Points (V/N/D)</label>
          <input name="points" value="3/1/0" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        </div>
      </div>
      <div class="mt-4 text-right">
        <button value="cancel" class="px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20">Annuler</button>
        <button id="create-tournament" class="px-3 py-2 rounded-xl bg-primary text-white">Créer</button>
      </div>
    </form>
  </dialog>
  `;
}

export function onMountTournaments() {
  const modal = document.getElementById('tournament-modal');
  document.getElementById('new-tournament-btn')?.addEventListener('click', () => modal.showModal());

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
        const goPricing = confirm(
          'Votre plan Free permet de créer 1 seul tournoi.\n\nPassez en Pro ou Club pour créer d\'autres tournois.\n\nVoulez-vous voir les plans ?'
        );
        if (goPricing) {
          // Aller vers la landing et faire défiler jusqu'à la section pricing
          location.hash = '#/';
          setTimeout(() => {
            const el = document.getElementById('pricing');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }
      } else {
        alert(error.message);
      }
      return;
    }
    modal.close();
    location.hash = `#/app/t/${data[0].id}`;
  });

  loadTournaments();
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
    <a href="#/app/t/${t.id}" class="block p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:shadow-soft transition">
      <div class="text-sm uppercase tracking-wide text-gray-500">${t.sport}</div>
      <div class="mt-1 font-semibold">${t.name}</div>
      <div class="text-sm text-gray-500">${t.location || ''} ${t.dates ? '· ' + t.dates : ''}</div>
    </a>
  `).join('');
}
