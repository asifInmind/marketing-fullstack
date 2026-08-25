import ShopifyProduct from '../../models/ShopifyProduct.js';
import { parseLinkHeader } from './shopifyCore.js';

export async function syncProductsFromShopify(shopDomain, shopify_token) {
  let allProducts = [];
  let nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/products.json`);
  nextUrl.searchParams.set('status', 'active');
  nextUrl.searchParams.set('limit', '250');

  console.log(`[Shopify API Route] Syncing products live from ${nextUrl.toString()}`);

  let hasNextPage = true;
  let pageCount = 1;

  while (hasNextPage && pageCount <= 10) {
    const response = await fetch(nextUrl.toString(), {
      headers: {
        "X-Shopify-Access-Token": shopify_token,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API returned: ${text}`);
    }

    const data = await response.json();
    if (data.products) {
      allProducts = [...allProducts, ...data.products];
    }

    const linkHeader = response.headers.get('link');
    const nextPageInfo = parseLinkHeader(linkHeader);

    if (nextPageInfo) {
      nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/products.json`);
      nextUrl.searchParams.set('page_info', nextPageInfo);
      nextUrl.searchParams.set('limit', '250');
      pageCount++;
    } else {
      hasNextPage = false;
    }
  }

  if (allProducts.length > 0) {
    const productPromises = allProducts.map(prod => {
      return ShopifyProduct.findOneAndUpdate(
        { storeUrl: shopDomain, productId: prod.id.toString() },
        {
          storeUrl: shopDomain,
          productId: prod.id.toString(),
          title: prod.title,
          handle: prod.handle,
          sku: prod.variants?.[0]?.sku || '',
          imageUrl: prod.image?.src || '',
          variants: prod.variants?.map(v => ({
            variantId: v.id.toString(),
            title: v.title,
            price: parseFloat(v.price || 0),
            sku: v.sku || '',
            inventoryQuantity: v.inventory_quantity
          })) || []
        },
        { upsert: true, new: true }
      );
    });
    await Promise.all(productPromises);
  }
  return allProducts;
}
