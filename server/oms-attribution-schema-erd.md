# OMS Multi-Tenant Attribution Schema — Entity Relationship Diagram

Full end-to-end ERD covering all 8 collections, every field, and every relationship
(tenant scoping, ad↔product mapping, ad↔order attribution, aggregation caching).

Paste the code block below into [mermaid.live](https://mermaid.live) to view/export as SVG or PNG,
or render it directly in any Markdown viewer that supports Mermaid (GitHub, Notion, Obsidian, etc.)

```mermaid
erDiagram
    MERCHANTS ||--o{ SHOPIFYPRODUCTS : "storeUrl"
    MERCHANTS ||--o{ ADMETADATA : "storeUrl"
    MERCHANTS ||--o{ DAILYADINSIGHTS : "storeUrl"
    MERCHANTS ||--o{ SHOPIFYORDERS : "storeUrl"
    MERCHANTS ||--o{ PRODUCTDAILYPERFORMANCE : "storeUrl"
    MERCHANTS ||--o{ ADPRODUCTMAPPINGS : "storeUrl"
    MERCHANTS ||--o{ ATTRIBUTIONERRORS : "storeUrl"

    ADMETADATA ||--o{ DAILYADINSIGHTS : "adId"
    ADMETADATA ||--o{ SHOPIFYORDERS : "attribution.adId (optional)"
    ADMETADATA ||--o| ADPRODUCTMAPPINGS : "adId (1:1 per store)"
    ADMETADATA }o--o{ PRODUCTDAILYPERFORMANCE : "topAdIds[] (cached, unenforced)"

    SHOPIFYPRODUCTS ||--o{ ADPRODUCTMAPPINGS : "shopifyProductId"
    SHOPIFYPRODUCTS ||--o{ PRODUCTDAILYPERFORMANCE : "productId"
    SHOPIFYPRODUCTS }o--o{ SHOPIFYORDERS : "lineItems[].productId (embedded)"

    MERCHANTS {
        ObjectId _id PK
        ObjectId organizationId "external parent OMS account"
        string brandName
        string storeUrl UK "tenant key"
        string shopifyAccessToken "encrypted"
        string currency "default PKR"
        string integrations_meta_accessToken
        string integrations_meta_adAccountId
        string integrations_meta_pixelId
        date integrations_meta_connectedAt
        date createdAt
        date updatedAt
    }

    SHOPIFYPRODUCTS {
        ObjectId _id PK
        string storeUrl FK
        string productId UK "Shopify product ID"
        string title
        string handle "URL slug, matches landing pages"
        string sku
        string imageUrl
        array variants "variantId, title, price, inventoryQuantity"
        date updatedAt
    }

    ADMETADATA {
        ObjectId _id PK
        string storeUrl FK
        string channel "default meta"
        string campaignId
        string campaignName
        string campaignStatus
        string campaignObjective
        string adSetId
        string adSetName
        string adSetStatus
        string adSetTargeting
        string adId UK "globally unique"
        string adName
        string adStatus
        string creative_creativeId
        string creative_creativeName
        string creative_thumbnailUrl
        string creative_bodyText
        string creative_destinationUrl "contains UTM + product handle"
        string creative_callToAction
        string creative_format "image, video, carousel"
        date lastUpdated
    }

    DAILYADINSIGHTS {
        ObjectId _id PK
        string storeUrl FK
        date date "daily bucket"
        string channel "default meta"
        string adId FK
        number spend
        number impressions
        number clicks
        number conversions
        number conversionValue
    }

    SHOPIFYORDERS {
        ObjectId _id PK
        string storeUrl FK
        string orderId UK
        string orderNumber
        date createdAt
        number totalPrice
        string currency
        date cancelledAt
        array lineItems "productId, variantId, quantity, price"
        string attribution_utmSource
        string attribution_utmMedium
        string attribution_utmCampaign
        string attribution_clickId "fbclid"
        string attribution_adId FK "nullable, meta ad that drove sale"
        string attribution_adName
        string attribution_campaignId
        string attribution_adSetId
        date attribution_attributedAt
        string attribution_attributionMethod "fbclid_match, utm_match, ip_match, organic"
    }

    PRODUCTDAILYPERFORMANCE {
        ObjectId _id PK
        string storeUrl FK
        string productId FK
        date date
        number adSpend
        number adImpressions
        number adClicks
        number shopifyRevenue
        number shopifyOrders
        number shopifyUnitsSold
        number attributedRevenue
        number attributedOrders
        number trueROAS "shopifyRevenue / adSpend"
        number blendedROAS "store-wide"
        array topAdIds "cached, not FK-enforced"
        date updatedAt
    }

    ADPRODUCTMAPPINGS {
        ObjectId _id PK
        string storeUrl FK
        string channel "default meta"
        string adId FK_UK "unique per storeUrl: 1 ad -> 1 product"
        string shopifyProductId FK
        string mappedBy "auto, manual"
        string matchMethod "url_handle, ad_name_keyword, sku_match, manual"
        number matchConfidence "0-100"
        string matchSource "matched URL/keyword"
        date updatedAt
    }

    ATTRIBUTIONERRORS {
        ObjectId _id PK
        string storeUrl FK
        string errorType "unmatched_ad, unmatched_order, api_failure"
        string source "meta, shopify"
        object rawData "captured request payload"
        string attemptedMatch
        string errorMessage
        date createdAt
        boolean resolved "default false"
    }
```

## Relationship summary

| # | From → To | Field | Cardinality | Notes |
|---|---|---|---|---|
| 1 | Merchants → ShopifyProducts | storeUrl | 1:N | Tenant scope |
| 2 | Merchants → AdMetadata | storeUrl | 1:N | Tenant scope |
| 3 | Merchants → DailyAdInsights | storeUrl | 1:N | Tenant scope |
| 4 | Merchants → ShopifyOrders | storeUrl | 1:N | Tenant scope |
| 5 | Merchants → ProductDailyPerformance | storeUrl | 1:N | Tenant scope |
| 6 | Merchants → AdProductMappings | storeUrl | 1:N | Tenant scope |
| 7 | Merchants → AttributionErrors | storeUrl | 1:N | Tenant scope |
| 8 | AdMetadata → DailyAdInsights | adId | 1:N | One ad, many daily rows |
| 9 | AdMetadata → ShopifyOrders | attribution.adId | 1:N (optional) | Nullable for organic orders |
| 10 | AdMetadata → AdProductMappings | adId | 1:1 per store | Unique index enforces single active mapping |
| 11 | ShopifyProducts → AdProductMappings | shopifyProductId | 1:N | One product, many mapped ads |
| 12 | ShopifyProducts → ProductDailyPerformance | productId | 1:N | One row per product per day |
| 13 | ShopifyProducts ↔ ShopifyOrders | lineItems[].productId | N:M | Embedded array, denormalized |
| 14 | AdMetadata ↔ ProductDailyPerformance | topAdIds[] | N:M (cached) | No referential integrity — display cache only |

## Design notes

- **`storeUrl`** is the multi-tenant partition key on every collection — not a formal Mongo ref, but functionally the most important relationship in the schema.
- **`AdProductMappings`** is named like a junction table but its unique index (`storeUrl + adId`) actually caps it at one product per ad — worth revisiting if you ever need one ad tied to multiple products.
- **`ShopifyOrders.attribution`** duplicates `campaignId`/`adSetId` from `AdMetadata` intentionally, to avoid a join on high-frequency attribution queries.
- **`ProductDailyPerformance.topAdIds`** and **`AdMetadata` are linked only by convention** — deleting an ad won't cascade or clean this array.
