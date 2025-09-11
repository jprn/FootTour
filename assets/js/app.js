import { addRoute, handleRoute, navigate } from './router.js';
import { supabase } from './supabaseClient.js';
import LandingPage from './pages/landing.js';
import TournamentsPage, { onMountTournaments } from './pages/tournaments.js';
import TournamentDashboardPage, { onMountTournamentDashboard } from './pages/tournament_dashboard.js';
import TeamsPage, { onMountTeams } from './pages/teams.js';
import AuthLoginPage, { onMountAuthLogin } from './pages/auth_login.js';
import AuthSignupPage, { onMountAuthSignup } from './pages/auth_signup.js';
import BillingCheckoutPage, { onMountBillingCheckout } from './pages/billing_checkout.js';
import SubscriptionPage, { onMountSubscription } from './pages/subscription.js';

// Helper to register on-mount callbacks per page
function onMount(fn) {
  window.__page_on_mount = window.__page_on_mount || [];
  window.__page_on_mount.push(fn);
}

// Simple toast utility (attached to window.showToast)
function showToast(message, { type = 'info', timeout = 2200 } = {}) {
  // remove existing
  document.querySelectorAll('.ft-toast').forEach(n => n.remove());
  const el = document.createElement('div');
  el.className = `ft-toast fixed z-50 left-1/2 -translate-x-1/2 top-4 px-4 py-2 rounded-2xl shadow-soft border text-sm
    ${type === 'success' ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-200'
      : type === 'error' ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200'
      : 'bg-white/90 border-gray-200 text-gray-900 dark:bg-white/10 dark:border-white/20 dark:text-white'}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); }, timeout);
}
window.showToast = showToast;

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
addRoute('/account/subscription', async () => {
  onMount(() => onMountSubscription());
  return SubscriptionPage();
});

// Auth UI and nav actions
async function renderNav() {
  const nav = document.getElementById('nav-actions');
  // Theme toggle button template
  const themeBtn = `<button id="theme-toggle" title="Thème" class="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-white/20">🌓</button>`;
  const { data: session } = await supabase.auth.getSession();
  if (session?.session) {
    const email = session.session.user?.email ?? '';
    // Load user plan for badge
    let plan = 'free';
    try {
      const { data: prof } = await supabase.from('profiles').select('plan').eq('id', session.session.user.id).single();
      plan = prof?.plan || 'free';
    } catch {}

    // Badge color per plan
    const badgeClass = (
      plan === 'pro' ? 'border-success/40 text-success' :
      plan === 'club' ? 'border-primary/40 text-primary' :
      'border-gray-300 text-gray-600 dark:border-white/20'
    );
    const planBadge = `<a href="#/account/subscription" class="px-2 py-1 rounded-xl text-xs border ${badgeClass}">${plan.toUpperCase()}</a>`;
    const upgradeCta = (
      plan === 'free' ? `<a href="#/billing/checkout?plan=pro" class="hidden sm:inline px-3 py-1.5 rounded-xl bg-primary text-white">Passer en Pro</a>` :
      plan === 'pro'  ? `<a href="#/billing/checkout?plan=club" class="hidden sm:inline px-3 py-1.5 rounded-xl bg-primary text-white">Passer en Club</a>` :
      ''
    );

    nav.innerHTML = `
      <div class="flex items-center gap-2">
        ${planBadge}
        <span class="hidden sm:inline text-sm text-gray-500">${email}</span>
        <a href="#/app/tournaments" class="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-white/20">Mes tournois</a>
        ${upgradeCta}
        ${themeBtn}
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
        ${themeBtn}
      </div>`;
  }

  // Update footer plan text
  try {
    const el = document.getElementById('footer-plan');
    if (el) {
      if (session?.session) {
        const { data: prof } = await supabase.from('profiles').select('plan').eq('id', session.session.user.id).single();
        const plan = prof?.plan || 'free';
        if (plan === 'free') {
          el.textContent = 'Plan Free: 1 tournoi, max 8 équipes. Passez en Pro pour plus de fonctionnalités.';
        } else if (plan === 'pro') {
          el.textContent = 'Plan Pro: tournois illimités, équipes illimitées, exports PDF/CSV, sans branding.';
        } else if (plan === 'club') {
          el.textContent = 'Plan Club: 99€/an — gestion de saison, multi-tournois, support prioritaire.';
        } else {
          el.textContent = `Plan ${plan.toUpperCase()}`;
        }
      } else {
        el.textContent = 'Plan invité: créez un compte pour commencer (Free disponible).';
      }
    }
  } catch {}

  // Setup theme toggle
  const html = document.documentElement;
  function applyTheme(t) {
    if (t === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }
  const stored = localStorage.getItem('ft-theme') || 'dark';
  applyTheme(stored);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = html.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('ft-theme', next);
    applyTheme(next);
  });
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

// Re-render nav when the URL changes or profile is updated
window.addEventListener('hashchange', renderNav);
window.addEventListener('profile:updated', renderNav);
