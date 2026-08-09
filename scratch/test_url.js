const urls = [
  'https://docs.google.com/spreadsheets/d/17o2T1_38rPgFHXLlMbbheudVMKginlpzr/edit?usp=sharing',
  'https://docs.google.com/spreadsheets/d/17o2T1_38rPgFHXLlMbbheudVMKginlpzr/pubhtml',
  'https://docs.google.com/spreadsheets/d/17o2T1_38rPgFHXLlMbbheudVMKginlpzr',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ.../pubhtml?gid=0&single=true',
  'https://docs.google.com/spreadsheets/d/17o2T1_38rPgFHXLlMbbheudVMKginlpzr/export?format=csv',
];

function normalizeGoogleSheetUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();

  // If already a csv export/pub link, return as is
  if (cleanUrl.includes('output=csv') || cleanUrl.includes('format=csv')) {
    return cleanUrl;
  }

  // Handle standard editor links
  if (cleanUrl.includes('/edit')) {
    cleanUrl = cleanUrl.replace(/\/edit.*$/, '/export?format=csv');
  } 
  // Handle published HTML links
  else if (cleanUrl.includes('/pubhtml')) {
    cleanUrl = cleanUrl.replace(/\/pubhtml.*$/, '/pub?output=csv');
  }
  // If it's just the document ID without /edit or /pubhtml, append /export
  else if (cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)) {
    cleanUrl = cleanUrl.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/export') && !cleanUrl.endsWith('/pub')) {
      cleanUrl += '/export?format=csv';
    } else {
      cleanUrl += '?format=csv';
    }
  }

  return cleanUrl;
}

urls.forEach(u => console.log(normalizeGoogleSheetUrl(u)));
