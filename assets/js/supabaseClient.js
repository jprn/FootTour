import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = (window?.ENV && window.ENV.SUPABASE_URL) || 'https://zggdblrhalwoycwhzukw.supabase.co';
const SUPABASE_ANON_KEY = (window?.ENV && window.ENV.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ2RibHJoYWx3b3ljd2h6dWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1ODkxNDEsImV4cCI6MjA3MzE2NTE0MX0.8QCsa7eQA-PefPUQwZik-xHI318mbXoLde4rcset6s4';

if (SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_ANON_KEY.includes('YOUR_ANON')) {
  console.warn('[FootTour] Configure Supabase credentials in assets/js/supabaseClient.js or inject window.ENV at runtime.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
