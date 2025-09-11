import { supabase } from '../supabaseClient.js';

function parseQuery() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  return {
    plan: q.get('plan') || 'pro',
  };
}

export default function BillingCheckoutPage() {
  const { plan } = parseQuery();
  return `
    <section class="max-w-lg mx-auto">
      <h1 id="bill-title" class="text-2xl font-semibold">Abonnement ${plan === 'club' ? 'Club' : 'Pro'}</h1>
      <p class="text-sm text-gray-500 mt-1">Simulation de paiement (test). Aucun prélèvement réel.</p>

      <div class="mt-6 p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <label class="text-sm">Choisir un plan</label>
        <select id="plan-select" class="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent">
          <option value="pro" ${plan==='pro' ? 'selected' : ''}>Pro — 12€/mois (ou 9€/tournoi)</option>
          <option value="club" ${plan==='club' ? 'selected' : ''}>Club — 99€/an</option>
        </select>

        <div class="mt-4 text-sm uppercase tracking-wide text-gray-500" id="bill-plan-badge">${plan.toUpperCase()}</div>
        <div class="text-xl font-semibold mt-1" id="bill-price">${plan==='club' ? '99€ / an' : '12€ / mois (ou 9€ / tournoi)'}</div>
        <ul id="bill-features" class="mt-4 space-y-1 text-sm"></ul>

        <button id="pay-now" class="mt-6 px-4 py-2 rounded-2xl bg-primary text-white w-full">Payer maintenant</button>
        <button id="cancel" class="mt-2 px-4 py-2 rounded-2xl border border-gray-300 dark:border-white/20 w-full">Annuler</button>
      </div>

      <div id="bill-msg" class="mt-4 text-sm"></div>
    </section>
  `;
}

export function onMountBillingCheckout() {
  const { plan: initial } = parseQuery();
  const msg = document.getElementById('bill-msg');
  const select = document.getElementById('plan-select');
  const title = document.getElementById('bill-title');
  const badge = document.getElementById('bill-plan-badge');
  const price = document.getElementById('bill-price');
  const features = document.getElementById('bill-features');

  function renderFeatures(p) {
    features.innerHTML = p === 'club'
      ? `
        <li>• Gestion de saison</li>
        <li>• Multi-tournois</li>
        <li>• Support prioritaire</li>
      `
      : `
        <li>• Tournois illimités</li>
        <li>• Équipes illimitées</li>
        <li>• Exports PDF/CSV</li>
        <li>• Branding retiré</li>
      `;
  }

  function applyPlan(p) {
    title.textContent = `Abonnement ${p === 'club' ? 'Club' : 'Pro'}`;
    badge.textContent = p.toUpperCase();
    price.textContent = p === 'club' ? '99€ / an' : '12€ / mois (ou 9€ / tournoi)';
    renderFeatures(p);
  }

  applyPlan(initial);

  select?.addEventListener('change', (e) => {
    applyPlan(e.target.value);
  });

  document.getElementById('cancel')?.addEventListener('click', () => {
    history.back();
  });

  document.getElementById('pay-now')?.addEventListener('click', async () => {
    msg.textContent = '';
    const plan = select?.value || 'pro';
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) { msg.textContent = 'Veuillez vous connecter.'; return; }

    // Simuler un paiement réussi, puis mettre à jour le plan dans profiles
    const { error } = await supabase.from('profiles')
      .update({ plan })
      .eq('id', session.session.user.id);

    if (error) { msg.textContent = error.message; return; }

    msg.textContent = 'Paiement réussi. Votre plan a été mis à jour.';
    setTimeout(() => { location.hash = '#/app/tournaments'; }, 800);
  });
}
