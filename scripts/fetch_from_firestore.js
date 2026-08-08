const fs = require('fs');
const path = require('path');

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const fields = doc.fields;
  const obj = { id: doc.name.split('/').pop() };
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
    else if (val.doubleValue !== undefined) obj[key] = parseFloat(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.arrayValue !== undefined) {
      obj[key] = (val.arrayValue.values || []).map(v => {
        if (v.mapValue && v.mapValue.fields) {
          const item = {};
          for (const [k2, v2] of Object.entries(v.mapValue.fields)) {
            if (v2.stringValue !== undefined) item[k2] = v2.stringValue;
            else if (v2.integerValue !== undefined) item[k2] = parseInt(v2.integerValue);
            else if (v2.doubleValue !== undefined) item[k2] = parseFloat(v2.doubleValue);
            else if (v2.booleanValue !== undefined) item[k2] = v2.booleanValue;
          }
          return item;
        }
        return v.stringValue || v.integerValue || v;
      });
    }
  }
  return obj;
}

async function fetchAllFirestoreProducts() {
  const allDocs = [];
  let pageToken = '';

  console.log('📡 Fetching all products directly from Firestore REST API...');

  while (true) {
    let url = 'https://firestore.googleapis.com/v1/projects/ecom-33627/databases/(default)/documents/products?pageSize=300';
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      console.error('Firestore fetch error:', res.status, txt);
      break;
    }

    const json = await res.json();
    if (json.documents && Array.isArray(json.documents)) {
      const parsed = json.documents.map(parseFirestoreDoc).filter(Boolean);
      allDocs.push(...parsed);
      console.log(`Fetched ${parsed.length} products (Total: ${allDocs.length})...`);
    }

    if (json.nextPageToken) {
      pageToken = json.nextPageToken;
    } else {
      break;
    }
  }

  console.log(`🎉 Total products retrieved from Firestore: ${allDocs.length}`);

  if (allDocs.length > 0) {
    const dest = path.join(__dirname, '../public/data/products.json');
    fs.writeFileSync(dest, JSON.stringify(allDocs, null, 2), 'utf8');
    console.log(`✅ Saved ${allDocs.length} products into ${dest}`);
  }
}

fetchAllFirestoreProducts().catch(err => console.error('Fetch error:', err));
