import { createClient } from "@supabase/supabase-js";

const url = "https://upwckimpkpxfzejrupkg.supabase.co";
const key = "sb_publishable_AzgYO9RznVv6B10D1ZdqJQ_A-ZsMBmc";

export const supabase = createClient(url, key);
