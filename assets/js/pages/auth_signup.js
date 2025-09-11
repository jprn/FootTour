import { supabase } from '../supabaseClient.js';

export default function AuthSignupPage() {
  return `
    <section class="max-w-md mx-auto">
      <h1 class="text-2xl font-semibold">Créer un compte</h1>
      <p class="text-sm text-gray-500 mt-1">Inscrivez-vous avec votre e-mail et un mot de passe.</p>

      <form id="signup-form" class="mt-6 space-y-3">
        <input type="email" name="email" placeholder="email@domaine.com" required class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        <input type="password" name="password" placeholder="Mot de passe (min 6)" minlength="6" required class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        <input type="password" name="passwordConfirm" placeholder="Confirmer le mot de passe" minlength="6" required class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        <div>
          <label class="text-sm">Plan</label>
          <select name="plan" class="w-full mt-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent">
            <option value="free" selected>Free (1 tournoi, 8 équipes)</option>
            <option value="pro">Pro (illimité, exports, sans branding)</option>
            <option value="club">Club (99€/an, saison & support)</option>
          </select>
        </div>
        <button id="signup-btn" class="px-3 py-2 rounded-2xl bg-primary text-white w-full">S'inscrire</button>
      </form>

      <div class="mt-4 text-sm">
        Déjà un compte ? <a href="#/auth/login" class="text-primary">Se connecter</a>
      </div>

      <div id="auth-msg" class="mt-4 text-sm"></div>
      <div class="mt-2">
        <button id="resend-email" class="text-sm underline">Renvoyer l'email de vérification</button>
      </div>
    </section>
  `;
}

export function onMountAuthSignup() {
  const form = document.getElementById('signup-form');
  const msg = document.getElementById('auth-msg');
  const resendBtn = document.getElementById('resend-email');
  const origin = (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : 'http://localhost:5173';

  // Preselect plan from query string if provided (e.g., #/auth/signup?plan=pro)
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  const planFromQuery = qs.get('plan');
  const planSelect = document.querySelector('select[name="plan"]');
  if (planFromQuery && ['free','pro','club'].includes(planFromQuery)) {
    planSelect.value = planFromQuery;
  }

  document.getElementById('signup-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const fd = new FormData(form);
    const email = fd.get('email');
    const password = fd.get('password');
    const passwordConfirm = fd.get('passwordConfirm');
    const plan = (fd.get('plan') || 'free');
    if (!email || !password) { msg.textContent = 'Veuillez saisir e-mail et mot de passe.'; return; }
    if (password !== passwordConfirm) { msg.textContent = 'Les mots de passe ne correspondent pas.'; return; }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/#/auth/login`,
        data: { plan },
      },
    });
    if (error) { msg.textContent = error.message; return; }

    msg.textContent = 'Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.';
    // Si plan payant, diriger vers la page de paiement simulé
    if (plan !== 'free') {
      setTimeout(() => { location.hash = `#/billing/checkout?plan=${plan}`; }, 600);
      return;
    }
    // Sinon, rester sur le flux classique
    setTimeout(() => { location.hash = '#/auth/login'; }, 800);
  });

  resendBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = fd.get('email');
    if (!email) { msg.textContent = 'Saisissez votre e-mail dans le formulaire pour renvoyer.'; return; }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${origin}/#/auth/login` },
    });
    if (error) { msg.textContent = error.message; return; }
    msg.textContent = 'E-mail de vérification renvoyé.';
  });
}
