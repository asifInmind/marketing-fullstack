import crypto from 'crypto';

// Helper to hash user data using SHA-256 as required by Meta CAPI
function sha256(data) {
  if (!data) return '';
  const clean = data.trim().toLowerCase();
  return crypto.createHash('sha256').update(clean).digest('hex');
}

// Clean and hash phone number: remove non-digit characters
function cleanAndHashPhone(phone) {
  if (!phone) return '';
  const clean = phone.replace(/[^\d]/g, '');
  return sha256(clean);
}

// Clean and hash country: convert to 2-character ISO lowercase
function cleanAndHashCountry(country) {
  if (!country) return '';
  let clean = country.trim().toLowerCase();
  if (clean === 'pakistan') clean = 'pk';
  else if (clean === 'united states' || clean === 'usa') clean = 'us';
  else if (clean.length > 2) clean = clean.slice(0, 2);
  return sha256(clean);
}

/**
 * Sends order events to Meta Conversions API (CAPI) in a background non-blocking manner.
 * @param {Object} merchant - Merchant database record
 * @param {Array} orders - ShopifyOrder database objects
 */
export async function sendOrdersToMetaCapi(merchant, orders) {
  if (!orders || orders.length === 0) return;
  
  const accessToken = merchant.fbAccessToken || merchant.integrations?.meta?.accessToken;
  const pixelId = merchant.integrations?.meta?.pixelId || process.env.META_PIXEL_ID;
  
  if (!accessToken) {
    console.warn(`[Meta CAPI] Skipping CAPI sync for ${merchant.storeUrl}: Missing Meta access token`);
    return;
  }
  
  if (!pixelId) {
    console.warn(`[Meta CAPI] Skipping CAPI sync for ${merchant.storeUrl}: Missing Pixel ID`);
    return;
  }
  
  // Filter for Meta-attributed orders that haven't been sent yet
  const eligibleOrders = orders.filter(order => {
    if (order.sentToMeta) return false;
    if (order.cancelledAt !== null) return false;
    
    // Check if Meta attributed
    const utmSource = order.attribution?.utmSource?.toLowerCase() || '';
    const clickId = order.attribution?.clickId || '';
    const referringSite = order.referringSite?.toLowerCase() || '';
    const isMeta = ['facebook', 'meta', 'instagram', 'fb', 'ig'].includes(utmSource) || 
                   !!clickId || 
                   referringSite.includes('facebook.com') || 
                   referringSite.includes('instagram.com');
                   
    return isMeta;
  });
  
  if (eligibleOrders.length === 0) {
    return;
  }
  
  console.log(`[Meta CAPI] Preparing to dispatch ${eligibleOrders.length} events to Meta for store ${merchant.storeUrl}...`);
  
  // Format events payload as required by Meta CAPI
  const events = eligibleOrders.map(order => {
    // Generate event time in UNIX seconds
    const eventTime = Math.floor(new Date(order.createdAt).getTime() / 1000);
    
    // User data hashing for compliance
    const userData = {};
    if (order.email) {
      userData.em = [sha256(order.email)];
    }
    
    if (order.customerInfo) {
      if (order.customerInfo.phone) {
        const hashedPh = cleanAndHashPhone(order.customerInfo.phone);
        if (hashedPh) userData.ph = [hashedPh];
      }
      if (order.customerInfo.firstName) {
        userData.fn = [sha256(order.customerInfo.firstName)];
      }
      if (order.customerInfo.lastName) {
        userData.ln = [sha256(order.customerInfo.lastName)];
      }
      if (order.customerInfo.city) {
        userData.ct = [sha256(order.customerInfo.city)];
      }
      if (order.customerInfo.province) {
        userData.st = [sha256(order.customerInfo.province)];
      }
      if (order.customerInfo.zip) {
        userData.zp = [sha256(order.customerInfo.zip)];
      }
      if (order.customerInfo.country) {
        const hashedCountry = cleanAndHashCountry(order.customerInfo.country);
        if (hashedCountry) userData.country = [hashedCountry];
      }
    }
    
    // Add click ID if available (extremely important for linking)
    if (order.attribution?.clickId) {
      userData.fbc = `fb.1.${new Date(order.createdAt).getTime()}.${order.attribution.clickId}`;
    }
    
    return {
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: order.orderNumber || order.orderId, // Matches client-side event ID for deduplication
      event_source_url: order.landingSite || `https://${merchant.storeUrl}`,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        currency: order.currency || 'PKR',
        value: parseFloat(order.totalPrice || 0)
      }
    };
  });
  
  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: events,
        access_token: accessToken
      })
    });
    
    const resJson = await response.json();
    
    if (!response.ok || resJson.error) {
      console.error(`[Meta CAPI Error] Meta API returned failure:`, resJson.error || resJson);
      return;
    }
    
    console.log(`[Meta CAPI Success] Successfully dispatched ${events.length} purchase events to Meta.`);
    
    // Update Mongoose records to sentToMeta = true
    const orderIds = eligibleOrders.map(o => o._id);
    const ShopifyOrder = (await import('../models/ShopifyOrder.js')).default;
    await ShopifyOrder.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          sentToMeta: true,
          sentToMetaAt: new Date()
        }
      }
    );
    
  } catch (err) {
    console.error(`[Meta CAPI Exception] Network error during CAPI dispatch:`, err.message);
  }
}
