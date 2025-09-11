import { supabase } from '../supabaseClient.js';

export default function AuthLoginPage() {
  return `
    <section class="max-w-md mx-auto">
      <h1 class="text-2xl font-semibold">Connexion</h1>
      <p class="text-sm text-gray-500 mt-1">Connectez-vous avec votre e-mail et mot de passe, ou recevez un lien magique.</p>

      <form id="login-form" class="mt-6 space-y-3">
        <input type="email" name="email" placeholder="email@domaine.com" required class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        <input type="password" name="password" placeholder="Mot de passe" class="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-transparent" />
        <div class="flex gap-2">
          <button id="login-btn" class="px-3 py-2 rounded-2xl bg-primary text-white">Se connecter</button>
          <button id="magic-btn" class="px-3 py-2 rounded-2xl border border-gray-300 dark:border-white/20">Lien magique</button>
        </div>
      </form>

      <div class="mt-4 text-sm">
        Pas de compte ? <a href="#/auth/signup" class="text-primary">Créer un compte</a>
      </div>

      <div id="auth-msg" class="mt-4 text-sm"></div>
    </section>
  `;
}

export function onMountAuthLogin() {
  const form = document.getElementById('login-form');
  const msg = document.getElementById('auth-msg');
  const origin = (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : 'http://localhost:5173';

  document.getElementById('login-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const fd = new FormData(form);
    const email = fd.get('email');
    const password = fd.get('password');
    if (!email || !password) { msg.textContent = 'Veuillez saisir e-mail et mot de passe.'; return; }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { emailRedirectTo: `${origin}/#/auth/login` },
    });
    if (error) { msg.textContent = error.message; return; }
    location.hash = '#/app/tournaments';
  });

  document.getElementById('magic-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const fd = new FormData(form);
    const email = fd.get('email');
    if (!email) { msg.textContent = 'Veuillez saisir votre e-mail.'; return; }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/#/auth/login` },
    });
    if (error) { msg.textContent = error.message; return; }
    msg.textContent = 'Lien magique envoyé. Vérifiez votre e-mail.';
  });
}
