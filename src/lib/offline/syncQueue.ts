//src/lib/offline/syncQueue.ts

async function sendToSupabase(op: PendingOp) {
  let q: any = supabase.from(op.table);

  if (op.action === 'insert') {
    if (op.conflictTarget) {
      // Replay dengan ignore duplicates → aman dikirim ulang
      const { error } = await q.upsert(op.payload, {
        onConflict: op.conflictTarget,
        ignoreDuplicates: true,
      });
      if (error) throw error;
    } else {
      const { error } = await q.insert(op.payload);
      if (error) throw error;
    }
  } else if (op.action === 'upsert') {
    const { error } = await q.upsert(
      op.payload,
      op.conflictTarget ? { onConflict: op.conflictTarget } : undefined
    );
    if (error) throw error;
  } else if (op.action === 'update') {
    let u = q.update(op.payload);
    const match = op.match ?? {};
    for (const [k, v] of Object.entries(match)) u = u.eq(k, v);
    const { error } = await u;
    if (error) throw error;
  } else if (op.action === 'delete') {
    let d = q.delete();
    const match = op.match ?? {};
    for (const [k, v] of Object.entries(match)) d = d.eq(k, v);
    const { error } = await d;
    if (error) throw error;
  }
}