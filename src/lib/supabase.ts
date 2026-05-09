import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Strip trailing slash and any path suffix (e.g. /rest/v1)
const url = rawUrl.trim().replace(/\/$/, "").replace(/\/(rest|auth|storage).*$/, "");

export const supabase = createClient(url, key);
