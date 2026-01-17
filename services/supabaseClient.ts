import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pfcpbagawkmedztuymrf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Dz9ILlX_d99ahT9GQyJmXA_6bfsZogT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);