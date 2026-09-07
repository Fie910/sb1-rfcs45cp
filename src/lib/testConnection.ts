import { supabase } from '@/lib/supabase';

export async function testConnection() {
  console.log('Testing Supabase connection...');
  console.log('URL:', import.meta.env.VITE_SUPABASE_URL);

  const { data, error } = await supabase
    .from('mata_pelajarans')
    .select('*')
    .limit(10);

  if (error) {
    console.error('Connection failed:', error.message);
    return;
  }

  console.log('Connection successful!');
  console.log('Data from mata_pelajarans:', data);
}

testConnection();
