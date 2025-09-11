import { supabase } from '../supabaseClient.js';

export default function SubscriptionPage() {
  return `
    <section class="max-w-xl mx-auto">
      <h1 class="text-2xl font-semibold">Abonnement</h1>
      <p class="text-sm text-gray-500 mt-1">Changez de plan à tout moment. Cette page simule la gestion d'abonnement.</p>

      <div class="mt-6 p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="text-sm">Plan actuel: <span id="current-plan" class="font-medium">—</span></div>
        <label class="text-sm block mt-4">Nouveau plan</label>
        <select id="sub-plan" class="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent">
          <option value="free">Free — 1 tournoi (8 équipes)</option>
          <option value="pro">Pro — 12€/mois (ou 9€/tournoi)</option>
          <option value="club">Club — 99€/an</option>
        </select>
        <div class="mt-4 flex gap-2">
          <button id="apply-plan" class="px-4 py-2 rounded-2xl bg-primary text-white">Continuer</button>
          <a href="#/billing/checkout" id="go-checkout" class="px-4 py-2 rounded-2xl border border-gray-300 dark:border-white/20 hidden">Procéder au paiement</a>
        </div>
        <div id="sub-msg" class="mt-3 text-sm"></div>
      </div>
    </section>
  `;
}

export function onMountSubscription() {
  const msg = document.getElementById('sub-msg');
  const currentEl = document.getElementById('current-plan');
  const select = document.getElementById('sub-plan');
  const goCheckout = document.getElementById('go-checkout');

  function updateCtaVisibility() {
    const p = select.value;
    if (p === 'free') {
      goCheckout.classList.add('hidden');
    } else {
      goCheckout.classList.remove('hidden');
      goCheckout.href = `#/billing/checkout?plan=${p}`;
    }
  }

  (async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) { msg.textContent = 'Veuillez vous connecter.'; return; }
    const uid = session.session.user.id;
    const { data: prof, error } = await supabase.from('profiles').select('plan').eq('id', uid).single();
    if (error) { msg.textContent = error.message; return; }
    currentEl.textContent = (prof?.plan || 'free').toUpperCase();
    select.value = prof?.plan || 'free';
    updateCtaVisibility();
  })();

  select.addEventListener('change', updateCtaVisibility);

  document.getElementById('apply-plan')?.addEventListener('click', async () => {
    msg.textContent = '';
    const plan = select.value;
    if (plan === 'free') {
      // Downgrade immédiat (simulation)
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) { msg.textContent = 'Veuillez vous connecter.'; return; }
      const { error } = await supabase.from('profiles').update({ plan }).eq('id', session.session.user.id);
      if (error) { msg.textContent = error.message; return; }
      msg.textContent = 'Votre plan a été mis à jour vers FREE.';
      setTimeout(() => { location.hash = '#/app/tournaments'; }, 800);
    } else {
      // Passer par la page de paiement simulé
      location.hash = `#/billing/checkout?plan=${plan}`;
    }
  });
}
