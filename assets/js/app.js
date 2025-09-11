import { addRoute, handleRoute, navigate } from './router.js';
import { supabase } from './supabaseClient.js';
import LandingPage from './pages/landing.js';
import TournamentsPage, { onMountTournaments } from './pages/tournaments.js';
import TournamentDashboardPage, { onMountTournamentDashboard } from './pages/tournament_dashboard.js';
import TeamsPage, { onMountTeams } from './pages/teams.js';
import AuthLoginPage, { onMountAuthLogin } from './pages/auth_login.js';
import AuthSignupPage, { onMountAuthSignup } from './pages/auth_signup.js';
import BillingCheckoutPage, { onMountBillingCheckout } from './pages/billing_checkout.js';

// Helper to register on-mount callbacks per page
function onMount(fn) {
  window.__page_on_mount = window.__page_on_mount || [];
  window.__page_on_mount.push(fn);
}

// Routes
addRoute('/', async () => LandingPage());
addRoute('/app/tournaments', async () => {
  onMount(() => onMountTournaments());
  return TournamentsPage();
});
addRoute('/app/t/:id', async ({ id }) => {
  onMount(() => onMountTournamentDashboard({ id }));
  return TournamentDashboardPage({ id });
});
addRoute('/app/t/:id/teams', async ({ id }) => {
  onMount(() => onMountTeams({ id }));
  return TeamsPage({ id });
});
addRoute('/auth/login', async () => {
  onMount(() => onMountAuthLogin());
  return AuthLoginPage();
});
addRoute('/auth/signup', async () => {
  onMount(() => onMountAuthSignup());
  return AuthSignupPage();
});
addRoute('/billing/checkout', async () => {
  onMount(() => onMountBillingCheckout());
  return BillingCheckoutPage();
});

// Auth UI and nav actions
async function renderNav() {
  const nav = document.getElementById('nav-actions');
  const { data: session } = await supabase.auth.getSession();
  if (session?.session) {
    const email = session.session.user?.email ?? '';
    nav.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="hidden sm:inline text-sm text-gray-500">${email}</span>
        <a href="#/app/tournaments" class="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-white/20">Mes tournois</a>
        <button id="logout" class="px-3 py-1.5 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-black">Déconnexion</button>
      </div>`;
    document.getElementById('logout')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      await renderNav();
      navigate('#/');
    });
  } else {
    nav.innerHTML = `
      <div class="flex items-center gap-2">
        <a href="#/auth/login" class="px-3 py-1.5 rounded-xl bg-primary text-white">Se connecter</a>
        <a href="#/auth/signup" class="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-white/20">Créer un compte</a>
      </div>`;
  }
}

// Auth modal behavior (landing)
function setupAuthHandlers() {
  document.addEventListener('click', (e) => {
    if (e.target?.id === 'login-btn') {
      document.getElementById('auth-modal')?.showModal();
    }
  });

  document.addEventListener('click', async (e) => {
    if (e.target?.id === 'magic-link') {
      e.preventDefault();
      const email = document.getElementById('auth-email')?.value;
      if (!email) return;
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) alert(error.message); else alert('Lien magique envoyé.');
    }
    if (e.target?.id === 'email-login') {
      e.preventDefault();
      const email = document.getElementById('auth-email')?.value;
      const password = document.getElementById('auth-password')?.value;
      if (!email) return;
      let { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error && password) {
        alert(error.message);
      } else if (!password) {
        // create user with password if not exists
        const res = await supabase.auth.signUp({ email, password: crypto.randomUUID() });
        if (res.error) alert(res.error.message); else alert('Compte créé, vérifiez votre e-mail.');
      }
      renderNav();
      document.getElementById('auth-modal')?.close();
    }
  });

  // auth state changes -> rerender nav
  supabase.auth.onAuthStateChange(() => {
    renderNav();
  });
}

setupAuthHandlers();
renderNav();
handleRoute();
