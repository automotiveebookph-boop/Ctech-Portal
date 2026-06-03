import { createClient } from "@supabase/supabase-js";

// C-Tech Fleet Portal — connects to the user's existing Supabase project
// where fleet_clients, vehicles, service_history, user_roles, etc. already live.
const SUPABASE_URL = "https://azcrctokesvpwxdptatl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6Y3JjdG9rZXN2cHd4ZHB0YXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTc5NzMsImV4cCI6MjA5NDMzMzk3M30.Z_Lvnb2bW5qXMr4yZiSuD2D7ggDvLpffH5Y4SDLp_cU";

export const supabaseFleet = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "ctech-fleet-auth",
  },
});
