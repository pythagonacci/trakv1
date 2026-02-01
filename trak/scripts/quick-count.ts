import { createClient } from '../src/lib/supabase/server';
async function run() {
  const supabase = await createClient();
  const { count: p } = await supabase.from('unstructured_parents').select('*', { count: 'exact', head: true });
  const { count: c } = await supabase.from('unstructured_chunks').select('*', { count: 'exact', head: true });
  const { count: j } = await supabase.from('indexing_jobs').select('*', { count: 'exact', head: true });
  console.log('COUNT_RESULTS:', { parents: p, chunks: c, jobs: j });
}
run().then(() => process.exit()).catch(e => { console.error(e); process.exit(1); });
