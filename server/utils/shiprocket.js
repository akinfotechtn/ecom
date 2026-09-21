const axios = require('axios');

/**
 * Shiprocket API helper class
 */
class ShiprocketHelper {
  constructor(email = '', password = '') {
    this.email = email;
    this.password = password;
    this.token = null;
    this.tokenExpiry = null;
  }

  async authenticate() {
    if (!this.email || !this.password) {
      return null;
    }

    // Return cached token if valid
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
        email: this.email,
        password: this.password
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        this.tokenExpiry = Date.now() + (9 * 24 * 60 * 60 * 1000); // 9 days token validity
        return this.token;
      }
    } catch (err) {
      console.warn('Shiprocket Auth Warning:', err.response?.data || err.message);
    }
    return null;
  }

  getDeliveryDays(pincode) {
    if (!pincode) return 3;
    const pin = String(pincode).trim();
    const p2 = pin.substring(0, 2);
    const p3 = pin.substring(0, 3);
    if (p3 === '600') return 1;
    if (['60', '61', '62', '63', '64'].includes(p2)) return 2;
    if (['50', '51', '52', '53', '56', '57', '58', '59', '67', '68', '69', '11', '40', '70'].includes(p2)) return 3;
    if (['12', '13', '14', '15', '16', '30', '31', '32', '33', '34', '36', '37', '38', '39', '41', '42', '43', '44', '45', '46', '47', '48'].includes(p2)) return 4;
    if (['17', '20', '21', '22', '23', '24', '25', '26', '27', '28', '71', '72', '73', '74', '75', '76', '77', '80', '81', '82', '83', '84', '85'].includes(p2)) return 5;
    if (['18', '19', '78', '79'].includes(p2) || p3 === '744') return 6;
    return 3;
  }

  async checkPincode(pincode, weightKg = 0.5) {
    const token = await this.authenticate();
    const days = this.getDeliveryDays(pincode);
    const etdText = days === 1 ? '1-2 Days' : `${days}-${days + 1} Days`;

    // Fallback simulation if credentials not configured or testing
    if (!token) {
      const isDeliverable = pincode && pincode.toString().length === 6;
      return {
        serviceable: isDeliverable,
        couriers: isDeliverable ? [
          { courier_name: 'Shiprocket Express', rate: 110, etd: etdText },
          { courier_name: 'Delhivery Surface', rate: 120, etd: `${days} Days` },
          { courier_name: 'Bluedart Air', rate: 160, etd: `${Math.max(1, days - 1)} Days` }
        ] : [],
        estimatedDays: isDeliverable ? days : 'N/A',
        mode: 'ZONE_ROUTING'
      };
    }

    try {
      const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=600001&delivery_postcode=${pincode}&weight=${weightKg}&cod=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return {
        serviceable: response.data.status === 200,
        couriers: response.data.data?.available_courier_companies || [],
        mode: 'LIVE'
      };
    } catch (err) {
      return {
        serviceable: true,
        couriers: [{ courier_name: 'Shiprocket Express', rate: 120, etd: etdText }],
        estimatedDays: days,
        mode: 'FALLBACK'
      };
    }
  }

  async createShiprocketOrder(orderDetails, settings) {
    const token = await this.authenticate();
    const orderId = orderDetails.id;

    if (!token) {
      return {
        success: true,
        shiprocketOrderId: `SR-SIM-${Date.now()}`,
        shipmentId: `SHP-SIM-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'NEW',
        note: 'Order logged locally. Set Shiprocket credentials in Admin settings for automated sync.'
      };
    }

    try {
      const payload = {
        order_id: orderId,
        order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        pickup_location: "Primary",
        billing_customer_name: orderDetails.customerName,
        billing_last_name: "",
        billing_address: orderDetails.address,
        billing_city: orderDetails.city || "Chennai",
        billing_pincode: orderDetails.pincode,
        billing_state: orderDetails.state || "Tamil Nadu",
        billing_country: "India",
        billing_email: orderDetails.email || "customer@example.com",
        billing_phone: orderDetails.phone,
        shipping_is_billing: true,
        order_items: orderDetails.items.map(item => ({
          name: item.productName,
          sku: item.id,
          units: item.quantity,
          selling_price: item.sellingPrice,
          discount: 0
        })),
        payment_method: orderDetails.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
        sub_total: orderDetails.finalTotal,
        length: 10,
        breadth: 10,
        height: 10,
        weight: 0.5
      };

      const response = await axios.post('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return {
        success: true,
        shiprocketOrderId: response.data.order_id,
        shipmentId: response.data.shipment_id,
        status: response.data.status,
        raw: response.data
      };
    } catch (err) {
      console.error('Shiprocket Create Order Error:', err.response?.data || err.message);
      return {
        success: false,
        shiprocketOrderId: `SR-SIM-${Date.now()}`,
        error: err.response?.data?.message || err.message
      };
    }
  }
}

module.exports = ShiprocketHelper;
