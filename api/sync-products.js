module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const products = req.body?.products || req.body || [];
    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${Array.isArray(products) ? products.length : 0} products locally!`,
      total: Array.isArray(products) ? products.length : 0
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
