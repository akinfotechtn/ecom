const nodemailer = require('nodemailer');

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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const order = req.body || {};
    if (!order || !order.id) {
      return res.status(400).json({ success: false, message: 'Missing order details.' });
    }

    const settings = order.settings || {};

    const smtpHost = settings.smtpHost || process.env.SMTP_HOST || 'smtp.zoho.in';
    const smtpPort = parseInt(settings.smtpPort || process.env.SMTP_PORT || '465');
    const smtpUser = settings.smtpUser || process.env.SMTP_USER || 'admin@akinfotechcctv.in';
    const smtpPass = settings.smtpPass || process.env.SMTP_PASS || '';
    const rawSender = settings.smtpSender || process.env.SMTP_SENDER || 'AK Infotech';
    const adminRecipientsStr = settings.smtpRecipients || process.env.SMTP_RECIPIENTS || 'akinfotechtn@gmail.com, admin@akinfotechcctv.in';

    if (!smtpPass) {
      console.warn("SMTP Password is missing. Cannot send order email.");
      return res.status(200).json({ success: false, message: 'SMTP Password missing in store settings.' });
    }

    // Format Sender (From Header) so Zoho/Gmail SMTP won't reject it
    const sender = rawSender.includes('<') ? rawSender : `"${rawSender}" <${smtpUser}>`;

    // Recipient list: Admin emails + Customer email
    const recipientList = adminRecipientsStr.split(',').map(s => s.trim()).filter(Boolean);
    const customerEmail = (order.email || order.userEmail || order.customerEmail || '').trim();
    if (customerEmail && !recipientList.some(e => e.toLowerCase() === customerEmail.toLowerCase())) {
      recipientList.push(customerEmail);
    }
    const recipients = recipientList.join(', ');

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465 SSL, false for TLS 587
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const SITE_URL = 'https://shop.akinfotechcctv.in';
    const getAbsoluteImageUrl = (photoLink) => {
      if (!photoLink) return `${SITE_URL}/images/logo.webp`;
      if (photoLink.startsWith('http://') || photoLink.startsWith('https://') || photoLink.startsWith('data:')) {
        return photoLink;
      }
      return `${SITE_URL}/${photoLink.replace(/^\/+/, '')}`;
    };

    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    let computedSubtotalWithGst = 0;
    const itemsHtml = (order.items || []).map(item => {
      const basePrice = Number(item.sellingPrice || item.price || 0);
      const gstPercent = (item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== '') 
        ? Number(item.gstPercent) 
        : (settings.defaultGstPercent !== undefined ? Number(settings.defaultGstPercent) : 18);
      const gstAmount = Math.round((basePrice * gstPercent) / 100);
      const itemPriceWithGst = basePrice + gstAmount;
      const qty = Number(item.quantity || item.qty || 1);
      const itemTotalWithGst = itemPriceWithGst * qty;
      computedSubtotalWithGst += itemTotalWithGst;

      const itemImgUrl = getAbsoluteImageUrl(item.photoLink || item.image || item.photo);
      const itemName = item.productName || item.name || 'Product';
      const noteVal = item.notes || item.itemNotes || '';
      const itemNoteHtml = noteVal 
        ? `<div style="margin-top: 4px; font-size: 0.78rem; color: #0284c7; background: #e0f2fe; border-left: 3px solid #0284c7; padding: 3px 6px; border-radius: 0 4px 4px 0; display: inline-block;">📝 <strong>Note:</strong> ${escapeHtml(noteVal)}</div>` 
        : '';

      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
            <table style="border-collapse: collapse; border: none;">
              <tr>
                <td style="padding: 0 10px 0 0; vertical-align: middle;">
                  <img src="${itemImgUrl}" alt="${escapeHtml(itemName)}" width="44" height="44" style="width: 44px; height: 44px; object-fit: contain; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; display: block;">
                </td>
                <td style="padding: 0; vertical-align: middle;">
                  <strong style="color: #0f172a; font-size: 0.92rem; line-height: 1.3;">${escapeHtml(itemName)}</strong>
                  ${itemNoteHtml}
                </td>
              </tr>
            </table>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; vertical-align: middle;">${qty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: middle;">₹${itemPriceWithGst.toLocaleString('en-IN')}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: middle; font-weight: bold; color: #0f172a;">₹${itemTotalWithGst.toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    const customerName = order.customerName || order.name || order.fullName || 'Customer';
    const emailSubject = `🎉 Order Confirmation #${order.id} - AK Infotech`;

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 3px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px;">
          <img src="${SITE_URL}/images/logo.webp" alt="AK Infotech" width="48" height="48" style="max-height: 48px; width: auto; margin-bottom: 6px; display: inline-block;">
          <h1 style="color: #0284c7; margin: 0 0 4px 0; font-size: 1.6rem;">AK INFOTECH</h1>
          <p style="color: #64748b; font-size: 0.95rem; margin: 0;">Official Order Confirmation & Invoice Receipt</p>
        </div>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="color: #0369a1; margin: 0 0 4px 0; font-size: 1.2rem;">Thank you for your order, ${customerName}!</h2>
          <p style="color: #0284c7; margin: 0; font-size: 0.88rem;">We have received your order <strong>#${order.id}</strong> and are processing it for shipment.</p>
        </div>
        
        <h3 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📋 Order Overview</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.92rem;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Order Reference:</strong></td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${order.id}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Order Date:</strong></td>
            <td style="padding: 6px 0; text-align: right;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Payment Mode:</strong></td>
            <td style="padding: 6px 0; text-align: right;">
              <span style="background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 0.82rem;">
                ${order.paymentMethod === 'COD' ? '💵 Cash on Delivery (COD)' : '💳 Paid Online'}
              </span>
            </td>
          </tr>
        </table>

        <h3 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📍 Shipping Address</h3>
        <p style="font-size: 0.9rem; line-height: 1.6; color: #334155; margin: 0 0 24px 0; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <strong>Name:</strong> ${customerName}<br>
          <strong>Phone:</strong> 📞 ${order.phone || order.custPhone || 'N/A'}<br>
          ${customerEmail ? `<strong>Email:</strong> 📧 ${customerEmail}<br>` : ''}
          <strong>Delivery Address:</strong> ${order.address || ''}, ${order.city || ''}, ${order.state || ''} - ${order.pincode || ''}
        </p>

        <h3 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📦 Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1;">Item Description</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #cbd5e1; width: 50px;">Qty</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #cbd5e1; width: 90px;">Price</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #cbd5e1; width: 90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-top: 10px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Subtotal (Incl. GST):</td>
            <td style="padding: 6px 0; text-align: right;">₹${computedSubtotalWithGst.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Delivery Charge:</td>
            <td style="padding: 6px 0; text-align: right;">${order.deliveryFee === 0 ? '<span style="color:#16a34a; font-weight:bold;">FREE</span>' : `₹${Number(order.deliveryFee || 0).toLocaleString('en-IN')}`}</td>
          </tr>
          ${order.discountAmount ? `
          <tr>
            <td style="padding: 6px 0; color: #16a34a;">Discount Applied:</td>
            <td style="padding: 6px 0; text-align: right; color: #16a34a;">-₹${Number(order.discountAmount || 0).toLocaleString('en-IN')}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #cbd5e1; font-size: 1.15rem; font-weight: bold;">
            <td style="padding: 12px 0; color: #0f172a;">Grand Total:</td>
            <td style="padding: 12px 0; text-align: right; color: #0284c7;">₹${Number(order.finalTotal || 0).toLocaleString('en-IN')}</td>
          </tr>
          ${order.paymentMethod === 'COD' ? `
          <tr style="font-size: 0.9rem; color: #64748b;">
            <td style="padding: 6px 0;">Advance Paid Online:</td>
            <td style="padding: 6px 0; text-align: right; color: #16a34a; font-weight: bold;">₹${Number(order.advancePaid || 1000).toLocaleString('en-IN')}</td>
          </tr>
          <tr style="font-size: 0.98rem; font-weight: bold; color: #9a3412; background: #fff7ed; border: 1px dashed #fed7aa;">
            <td style="padding: 10px;">Balance Due at Delivery:</td>
            <td style="padding: 10px; text-align: right;">₹${Number(order.balanceOnDelivery || 0).toLocaleString('en-IN')}</td>
          </tr>
          ` : ''}
        </table>

        <div style="margin-top: 32px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <p style="font-size: 0.88rem; color: #64748b; margin-bottom: 12px;">Need help with your order? Our team is available to assist you.</p>
          <a href="https://wa.me/919500673207" target="_blank" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 20px; font-weight: bold; font-size: 0.9rem;">
            💬 Chat with Support on WhatsApp
          </a>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: sender,
      to: recipients,
      subject: emailSubject,
      html: emailBody
    });

    console.log(`✉️ Order email sent successfully to ${recipients}:`, info.messageId);
    return res.status(200).json({ success: true, message: `Email sent to ${recipients}`, messageId: info.messageId });
  } catch (err) {
    console.error('Email sending error:', err);
    return res.status(500).json({ success: false, message: err.message || String(err) });
  }
};
