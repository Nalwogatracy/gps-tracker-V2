import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xqedndprwkomvnqhtnlq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZWRuZHByd2tvbXZucWh0bmxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDY2MzcsImV4cCI6MjA5MTkyMjYzN30.wnrNTjZ-Sltcuh5vW-rROVPcvOB7Myj9BWd3YdOdCqs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
