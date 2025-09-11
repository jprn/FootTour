import { supabase } from '../supabaseClient.js';

function parseQuery() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  return {
    plan: q.get('plan') || 'pro',
  };
}

export default function BillingCheckoutPage() {
  const { plan } = parseQuery();
  const title = plan === 'club' ? 'Abonnement Club' : 'Abonnement Pro';
  const price = plan === 'club' ? '99€ / an' : '12€ / mois (ou 9€ / tournoi)';
  return `
    <section class="max-w-lg mx-auto">
      <h1 class="text-2xl font-semibold">${title}</h1>
      <p class="text-sm text-gray-500 mt-1">Simulation de paiement (test). Aucun prélèvement réel.</p>

      <div class="mt-6 p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="text-sm uppercase tracking-wide text-gray-500">${plan.toUpperCase()}</div>
        <div class="text-xl font-semibold mt-1">${price}</div>
        <ul class="mt-4 space-y-1 text-sm">
          ${plan === 'club' ? `
            <li>• Gestion de saison</li>
            <li>• Multi-tournois</li>
            <li>• Support prioritaire</li>
          ` : `
            <li>• Tournois illimités</li>
            <li>• Équipes illimitées</li>
            <li>• Exports PDF/CSV</li>
            <li>• Branding retiré</li>
          `}
        </ul>
        <button id="pay-now" class="mt-6 px-4 py-2 rounded-2xl bg-primary text-white w-full">Payer maintenant</button>
        <button id="cancel" class="mt-2 px-4 py-2 rounded-2xl border border-gray-300 dark:border-white/20 w-full">Annuler</button>
      </div>

      <div id="bill-msg" class="mt-4 text-sm"></div>
    </section>
  `;
}

export function onMountBillingCheckout() {
  const { plan } = parseQuery();
  const msg = document.getElementById('bill-msg');

  document.getElementById('cancel')?.addEventListener('click', () => {
    history.back();
  });

  document.getElementById('pay-now')?.addEventListener('click', async () => {
    msg.textContent = '';
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
