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

  async checkPincode(pincode, weightKg = 0.5) {
    const token = await this.authenticate();

    // Fallback simulation if credentials not configured or testing
    if (!token) {
      const isDeliverable = pincode && pincode.toString().length === 6;
      return {
        serviceable: isDeliverable,
        couriers: isDeliverable ? [
          { courier_name: 'Delhivery Express', rate: 120, etd: '3-4 Days' },
          { courier_name: 'Bluedart Surface', rate: 150, etd: '2-3 Days' },
          { courier_name: 'Ekart Logistics', rate: 100, etd: '4-5 Days' }
        ] : [],
        estimatedDays: isDeliverable ? '3-5 Days' : 'N/A',
        mode: 'SIMULATED (Configure Shiprocket Email/Password in Admin)'
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
        couriers: [{ courier_name: 'Standard Express', rate: 150, etd: '3-5 Days' }],
        estimatedDays: '3-5 Days',
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
