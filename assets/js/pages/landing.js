export default function LandingPage() {
  return `
  <section class="grid md:grid-cols-2 gap-8 items-center">
    <div>
      <h1 class="text-3xl md:text-4xl font-bold tracking-tight">Gérez vos tournois multi-sport simplement</h1>
      <p class="mt-3 text-gray-600 dark:text-gray-300">Créez un tournoi, ajoutez vos équipes, générez le planning et publiez une page publique. Football, basket, volley, handball, futsal.</p>
      <div class="mt-6 flex gap-3">
        <a href="#/app/tournaments" class="px-4 py-2 rounded-2xl bg-primary text-white shadow-soft">Ouvrir l'app</a>
        <button id="login-btn" class="px-4 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Se connecter</button>
      </div>
    </div>
    <div class="p-4 bg-white/60 dark:bg-white/5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-soft">
      <img src="https://images.unsplash.com/photo-1521417531039-94df5fbc7613?q=80&w=1200&auto=format&fit=crop" alt="tournoi" class="rounded-xl w-full h-64 object-cover" />
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
