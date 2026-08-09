module.exports = async function handler(req, res) {
  // Set CORS headers
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, email, password, token, payload, shipment_id, courier_id, pickup_postcode, delivery_postcode, weight, cod } = req.body || {};

    if (action === 'login') {
      const loginRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await loginRes.json();
      return res.status(loginRes.status).json(data);
    }

    if (action === 'create_order') {
      const orderRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await orderRes.json();
      return res.status(orderRes.status).json(data);
    }

    if (action === 'get_couriers') {
      const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=${pickup_postcode || '603202'}&delivery_postcode=${delivery_postcode || '600001'}&weight=${weight || 0.5}&cod=${cod ? 1 : 0}`;
      const courierRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await courierRes.json();
      return res.status(courierRes.status).json(data);
    }

    if (action === 'generate_awb') {
      const awbRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_id, courier_id })
      });
      const data = await awbRes.json();
      return res.status(awbRes.status).json(data);
    }

    if (action === 'generate_label') {
      const labelRes = await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_id: [shipment_id] })
      });
      const data = await labelRes.json();
      return res.status(labelRes.status).json(data);
    }

    if (action === 'cancel_order') {
      const { ids, awbs } = req.body || {};
      let cancelRes;
      if (awbs && awbs.length) {
        cancelRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ awbs })
        });
      } else {
        const orderIds = ids ? (Array.isArray(ids) ? ids : [ids]) : [];
        cancelRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ ids: orderIds })
        });
      }
      const data = await cancelRes.json();
      return res.status(cancelRes.status).json(data);
    }

    return res.status(400).json({ success: false, message: `Unknown Shiprocket action: ${action}` });
  } catch (err) {
    console.error("Shiprocket proxy error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
