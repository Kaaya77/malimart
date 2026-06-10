const supabaseUrl = 'https://ubpapxdmqlepynonhaeo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicGFweGRtcWxlcHlub25oYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODU2NTQsImV4cCI6MjA4MTA2MTY1NH0.kjkY_jrvek-7pp2KWQytVzxxK9LL2SL1sPhsMLnGBSY';

async function run() {
  const res = await fetch(`${supabaseUrl}/rest/v1/orders?limit=1`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
