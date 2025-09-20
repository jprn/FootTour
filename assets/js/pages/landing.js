export default function LandingPage() {
  return `
  <section class="grid md:grid-cols-2 gap-8 items-center">
    <div>
      <h1 class="text-3xl md:text-4xl font-bold tracking-tight">Gérez vos tournois multi-sport simplement</h1>
      <p class="mt-3 text-gray-600 dark:text-gray-300">Créez un tournoi, ajoutez vos équipes, générez le programme des rencontres et publiez une page publique. Football, basket, volley, handball, futsal.</p>
      <div class="mt-6 flex gap-3">
        <a href="#/app/tournaments" class="px-4 py-2 rounded-2xl bg-primary text-white shadow-soft">Ouvrir l'app</a>
        <a href="#/auth/login" class="px-4 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Se connecter</a>
      </div>
    </div>
    <div class="p-4 bg-white/60 dark:bg-white/5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-soft">
      <img src="https://images.unsplash.com/photo-1521417531039-94df5fbc7613?q=80&w=1200&auto=format&fit=crop" alt="tournoi" class="rounded-xl w-full h-64 object-cover" />
    </div>
  </section>

  <section id="pricing" class="mt-16">
    <h2 class="text-2xl font-semibold text-center">Choisissez votre plan</h2>
    <p class="text-center text-gray-500 mt-1">Commencez gratuitement. Passez en Pro ou Club quand vous en avez besoin.</p>
    <div class="mt-8 grid md:grid-cols-3 gap-4">
      <!-- Free -->
      <div class="p-6 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="text-sm uppercase tracking-wide text-gray-500">Free</div>
        <div class="mt-1 text-2xl font-semibold">0€</div>
        <ul class="mt-4 space-y-2 text-sm">
          <li>• 1 tournoi</li>
          <li>• Jusqu'à 8 équipes</li>
          <li>• Programme des rencontres de base</li>
          <li>• App mobile feuille de match</li>
        </ul>
        <a href="#/auth/signup" class="mt-6 inline-block w-full text-center px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Créer un compte</a>
      </div>

      <!-- Pro -->
      <div class="p-6 rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-soft">
        <div class="text-sm uppercase tracking-wide text-primary">Pro</div>
        <div class="mt-1 text-2xl font-semibold">9€ / tournoi<br class="sm:hidden" /><span class="text-base font-normal text-gray-500">ou 12€/mois</span></div>
        <ul class="mt-4 space-y-2 text-sm">
          <li>• Tournois illimités</li>
          <li>• Équipes illimitées</li>
          <li>• Exports PDF/CSV</li>
          <li>• Branding FootTour retiré</li>
        </ul>
        <a href="#/auth/signup?plan=pro" class="mt-6 inline-block w-full text-center px-3 py-2 rounded-2xl bg-primary text-white">Passer en Pro</a>
      </div>

      <!-- Club -->
      <div class="p-6 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5">
        <div class="text-sm uppercase tracking-wide text-gray-500">Club</div>
        <div class="mt-1 text-2xl font-semibold">99€ / an</div>
        <ul class="mt-4 space-y-2 text-sm">
          <li>• Gestion de saison</li>
          <li>• Multiples tournois</li>
          <li>• Support prioritaire</li>
          <li>• Accès club staff</li>
        </ul>
        <a href="#/auth/signup?plan=club" class="mt-6 inline-block w-full text-center px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Contacter le support</a>
      </div>
    </div>
  </section>

  ${AuthModal()}
  `;
}

function AuthModal() {
  return `
  <dialog id="auth-modal" class="backdrop:bg-black/30 rounded-2xl p-0">
    <form method="dialog" class="p-6 w-[28rem] max-w-[95vw] bg-white dark:bg-dark rounded-2xl border border-gray-200/80 dark:border-white/10">
      <h2 class="text-xl font-semibold">Connexion / Inscription</h2>
      <p class="text-sm text-gray-500 mt-1">Par e-mail (lien magique) ou mot de passe.</p>
      <div class="mt-4 space-y-3">
        <input type="email" id="auth-email" placeholder="email@domaine.com" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" required />
        <input type="password" id="auth-password" placeholder="Mot de passe (optionnel)" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
      </div>
      <div class="mt-4 flex gap-2">
        <button id="magic-link" class="px-3 py-2 rounded-xl bg-primary text-white">Recevoir un lien magique</button>
        <button id="email-login" class="px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20">Se connecter</button>
      </div>
      <div class="mt-4 text-right">
        <button value="cancel" class="text-sm text-gray-500">Fermer</button>
      </div>
    </form>
  </dialog>
  `;
}
