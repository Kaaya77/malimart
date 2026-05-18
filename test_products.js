const supabaseUrl = 'https://ubpapxdmqlepynonhaeo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicGFweGRtcWxlcHlub25oYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODU2NTQsImV4cCI6MjA4MTA2MTY1NH0.kjkY_jrvek-7pp2KWQytVzxxK9LL2SL1sPhsMLnGBSY';

async function run() {
  const url = `${supabaseUrl}/rest/v1/products?select=id,name,price,sale_price,images,category,subcategory,stock,rating,review_count,status,is_boosted,created_at,seller_id,brand,condition,warranty_period,location,latitude,longitude,description,tags&deleted_at=is.null&order=created_at.desc&limit=40`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'count=exact'
    }
  });

  if (!res.ok) {
     console.error('Fetch failed for products:', res.status, await res.text());
  } else {
     const data = await res.json();
     console.log('Success:', data.length, 'products fetched');
  }
}
run();
