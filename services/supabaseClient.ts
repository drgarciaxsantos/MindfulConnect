import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ozolagmwrjesamwfmmoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2xhZ213cmplc2Ftd2ZtbW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDExNDMsImV4cCI6MjA4MDQxNzE0M30.tg0NlDo8JCydXXphgNmYnnV7-4I1b6fPYcDhvIUA_ao';

export const supabase = createClient(supabaseUrl, supabaseKey);