import { createClient } from '../src/lib/supabase/server';

async function check() {
  try {
    const supabase = await createClient();
    
    const { count: parentCount } = await supabase
      .from('unstructured_parents')
      .select('*', { count: 'exact', head: true });
      
    const { count: chunkCount } = await supabase
      .from('unstructured_chunks')
      .select('*', { count: 'exact', head: true });
      
    const { data: latestParents, error: parentError } = await supabase
      .from('unstructured_parents')
      .select('id, summary, source_type, workspace_id, summary_embedding')
      .limit(5);

    if (parentError) {
        console.error('Error fetching parents:', parentError);
    }

    console.log('--- Index Status ---');
    console.log('Parents indexed:', parentCount);
    console.log('Chunks indexed:', chunkCount);
    
    if (latestParents) {
        latestParents.forEach((p, i) => {
            const hasEmbedding = !!p.summary_embedding;
            console.log(`Parent ${i+1}: ID=${p.id}, Workspace=${p.workspace_id}, Type=${p.source_type}, HasEmbedding=${hasEmbedding}`);
            if (hasEmbedding) {
                const vecStr = String(p.summary_embedding);
                console.log(`  Embedding snippet: ${vecStr.slice(0, 50)}...`);
            }
        });
    }
  } catch (err) {
    console.error('Check failed:', err);
  }
}

check().catch(console.error);
