import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

// Explicit inserts only: never overwrite a real creator or forge registry receipts.
const profiles = JSON.parse(await readFile(new URL('../data/demo-profiles.json', import.meta.url), 'utf8'));
const rows = await Promise.all(profiles.map(async profile => {
  const bytes = await readFile(new URL(`../public/demo/creators/${profile.image}`, import.meta.url));
  if (bytes.length > 1024 * 1024) throw Error(`Portrait too large: ${profile.alias}`);
  const avatar = `data:image/webp;base64,${bytes.toString('base64')}`;
  return {
    id: profile.id, username: profile.alias, wallet_address: profile.wallet,
    display_name: profile.name, bio: profile.bio, avatar_url: avatar,
    published: false, tips_enabled: false,
    design: { version: 1, alias: profile.alias, name: profile.name, bio: profile.bio,
      avatar, cover: '', accent: profile.accent, theme: 'dark', rounded: true,
      links: [], socials: profile.socials ?? { instagram: '', youtube: '', x: '' } },
  };
}));
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ mode: 'preview', profiles: rows.map(({username,display_name,published}) => ({alias:username,name:display_name,published})) },null,2));
} else {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw Error('Configure SUPABASE_URL and SUPABASE_SECRET_KEY.');
  const db = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:existing,error:readError} = await db.from('cards_users').select('id,username,wallet_address').in('username',rows.map(row=>row.username));
  if (readError) throw Error(`Could not inspect demo aliases (${readError.code}).`);
  for (const found of existing) {
    const expected=rows.find(row=>row.username===found.username);
    if (found.id!==expected.id || found.wallet_address!==expected.wallet_address) throw Error(`Alias belongs to another profile: ${found.username}`);
  }
  const pending=rows.filter(row=>!existing.some(found=>found.id===row.id));
  if (pending.length) {
    const {error}=await db.from('cards_users').insert(pending);
    if(error) throw Error(`Could not seed profiles (${error.code}). No existing rows were changed.`);
  }
  const {data:stored,error:verifyError}=await db.from('cards_users').select('id,username,display_name,avatar_url,published,tips_enabled').in('id',rows.map(row=>row.id));
  if(verifyError || stored?.length!==rows.length || stored.some(row=>!row.avatar_url?.startsWith('data:image/webp;base64,'))) throw Error('Seed verification failed.');
  console.log(JSON.stringify({inserted:pending.length,existing:existing.length,profiles:stored.map(({avatar_url,...row})=>({...row,image_bytes:Buffer.from(avatar_url.split(',')[1],'base64').length}))},null,2));
}
