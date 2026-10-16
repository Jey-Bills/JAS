import { getSupabaseClient } from './supabase-client.js';
import { getSession } from './admin-auth.js';
const supabase = await getSupabaseClient();
const session = await getSession();
if (!session) location.replace('/jas-hub/login.html');
const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
const factor = factors?.totp?.find(item => item.status === 'verified');
if (factorError || !factor) location.replace('/jas-hub/');
let challengeId;
const msg = document.getElementById('message');
const key = 'jas_admin_mfa_attempts';
function state() { try { return JSON.parse(localStorage.getItem(key)||'[]').filter(t=>Date.now()-t<900000); } catch { return []; } }
try { const { data, error } = await supabase.auth.mfa.challenge({ factorId: factor.id }); if (error) throw error; challengeId = data.id; }
catch { msg.textContent='Unable to start verification. Please sign in again.'; document.getElementById('verify').disabled=true; }
document.getElementById('logout').addEventListener('click', async e=>{e.preventDefault(); await supabase.auth.signOut(); location.replace('/jas-hub/login.html');});
document.getElementById('challenge-form').addEventListener('submit', async e=>{e.preventDefault(); const attempts=state(); if(attempts.length>=5){msg.textContent='Too many attempts. Please wait 15 minutes.';return;} const code=document.getElementById('code').value.trim(); const {error}=await supabase.auth.mfa.verify({factorId:factor.id, challengeId, code}); if(error){attempts.push(Date.now());localStorage.setItem(key,JSON.stringify(attempts));msg.textContent='Invalid code. Please try again.';document.getElementById('code').value=''; try { const r=await supabase.auth.mfa.challenge({factorId:factor.id}); challengeId=r.data.id; } catch {} return;} localStorage.removeItem(key);location.replace('/jas-hub/');});
