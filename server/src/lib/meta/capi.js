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

// Helper to resolve Meta Pixel ID dynamically (queries Meta API if not cached in DB)
async function resolveMetaPixelId(merchant) {
  if (merchant.integrations?.meta?.pixelId) {
    return merchant.integrations.meta.pixelId;
  }
  if (process.env.META_PIXEL_ID) {
    return process.env.META_PIXEL_ID;
  }

  const accessToken = merchant.fbAccessToken || merchant.integrations?.meta?.accessToken;
  let adAccountId = merchant.adAccountId || merchant.integrations?.meta?.adAccountId;

  if (!accessToken || !adAccountId) {
    return null;
  }

  // Clean ad account ID (must start with act_)
  const cleanId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  try {
    console.log(`[Meta CAPI] Pixel ID missing. Attempting to auto-resolve pixels for ad account ${cleanId}...`);
    const res = await fetch(`https://graph.facebook.com/v20.0/${cleanId}/adspixels?fields=id,name&access_token=${accessToken}`);
    const json = await res.json();

    if (!res.ok || json.error) {
      console.error(`[Meta CAPI] Failed to fetch pixels from Meta:`, json.error || json);
      return null;
    }

    if (json.data && json.data.length > 0) {
      const pixelId = json.data[0].id;
      const pixelName = json.data[0].name;
      console.log(`[Meta CAPI] Auto-detected Pixel ID: ${pixelId} (${pixelName})`);

      // Save it on the merchant record so we don't query it next time
      merchant.integrations = merchant.integrations || {};
      merchant.integrations.meta = merchant.integrations.meta || {};
      merchant.integrations.meta.pixelId = pixelId;
      await merchant.save();

      return pixelId;
    } else {
      console.warn(`[Meta CAPI] No pixels found for ad account ${cleanId}`);
    }
  } catch (err) {
    console.error(`[Meta CAPI] Exception during pixel auto-resolution:`, err.message);
  }

  return null;
}

export async function sendOrdersToMetaCapi(merchant, orders) {
  if (!orders || orders.length === 0) {
    console.log(`[Meta CAPI] CAPI Sync called but received 0 orders.`);
    return;
  }
  
  console.log(`[Meta CAPI] CAPI Sync triggered for store: ${merchant.storeUrl} with ${orders.length} unsent orders.`);

  const accessToken = merchant.fbAccessToken || merchant.integrations?.meta?.accessToken;
  
  if (!accessToken) {
    console.warn(`[Meta CAPI] Skipping CAPI sync for ${merchant.storeUrl}: Missing Meta access token`);
    return;
  }
  
  const pixelId = await resolveMetaPixelId(merchant);
  
  if (!pixelId) {
    console.warn(`[Meta CAPI] Skipping CAPI sync for ${merchant.storeUrl}: Missing Pixel ID (could not be auto-resolved)`);
    return;
  }
  
  console.log(`[Meta CAPI] Using Access Token: (present), Pixel ID: ${pixelId}`);
  
  // Filter and split Meta-attributed orders into dispatchable (<= 7 days old) and too-old (> 7 days old)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dispatchableOrders = [];
  const tooOldOrders = [];

  orders.forEach(order => {
    if (order.sentToMeta) return;
    if (order.cancelledAt) return;
    
    // Check if Meta attributed
    const utmSource = (order.attribution?.utmSource || '').toLowerCase().trim();
    const clickId = (order.attribution?.clickId || '').trim();
    const referringSite = (order.referringSite || '').toLowerCase().trim();
    const isMeta = ['facebook', 'meta', 'instagram', 'fb', 'ig'].some(src => utmSource.includes(src)) || 
                   !!clickId || 
                   referringSite.includes('facebook.com') || 
                   referringSite.includes('instagram.com');
                   
    if (isMeta) {
      if (new Date(order.createdAt) >= sevenDaysAgo) {
        dispatchableOrders.push(order);
      } else {
        tooOldOrders.push(order);
      }
    }
  });

  console.log(`[Meta CAPI] Total matching Meta orders: ${dispatchableOrders.length + tooOldOrders.length} (Dispatchable: ${dispatchableOrders.length}, Historical skipped: ${tooOldOrders.length})`);

  // A. Immediately mark too-old orders as sentToMeta in the database to prevent endless retries
  if (tooOldOrders.length > 0) {
    try {
      console.log(`[Meta CAPI] Marking ${tooOldOrders.length} historical orders (>7 days old) as processed in database.`);
      const oldOrderIds = tooOldOrders.map(o => o.orderId);
      const ShopifyOrder = (await import('../../models/ShopifyOrder.js')).default;
      await ShopifyOrder.updateMany(
        { storeUrl: merchant.storeUrl, orderId: { $in: oldOrderIds } },
        {
          $set: {
            sentToMeta: true,
            sentToMetaAt: new Date()
          }
        }
      );
    } catch (dbErr) {
      console.error(`[Meta CAPI Error] Failed to flag historical orders in DB:`, dbErr.message);
    }
  }

  if (dispatchableOrders.length === 0) {
    return;
  }

  console.log(`[Meta CAPI] Preparing to dispatch ${dispatchableOrders.length} events to Meta for store ${merchant.storeUrl}...`);

  // Format events payload as required by Meta CAPI
  const events = dispatchableOrders.map(order => {
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

  const BATCH_SIZE = 100;
  const totalEvents = events.length;
  console.log(`[Meta CAPI] Dispatching ${totalEvents} purchase events in batches of ${BATCH_SIZE} for store ${merchant.storeUrl}...`);

  for (let i = 0; i < totalEvents; i += BATCH_SIZE) {
    const eventBatch = events.slice(i, i + BATCH_SIZE);
    const orderBatch = dispatchableOrders.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: eventBatch,
          access_token: accessToken
        })
      });
      
      const resJson = await response.json();
      
      if (!response.ok || resJson.error) {
        console.error(`[Meta CAPI Error] Batch dispatch failed (index ${i}-${i + eventBatch.length}):`, resJson.error || resJson);
        continue;
      }
      
      console.log(`[Meta CAPI Success] Successfully dispatched batch (${i}-${i + eventBatch.length}) of ${eventBatch.length} events to Meta.`);
      
      // Update Mongoose records to sentToMeta = true for this successful batch
      const orderIds = orderBatch.map(o => o.orderId);
      const ShopifyOrder = (await import('../../models/ShopifyOrder.js')).default;
      await ShopifyOrder.updateMany(
        { storeUrl: merchant.storeUrl, orderId: { $in: orderIds } },
        {
          $set: {
            sentToMeta: true,
            sentToMetaAt: new Date()
          }
        }
      );
      
    } catch (err) {
      console.error(`[Meta CAPI Exception] Network error during CAPI batch dispatch (index ${i}-${i + eventBatch.length}):`, err.message);
    }
  }
}
