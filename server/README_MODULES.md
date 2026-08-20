# Backend Module Reference Guide

This document explains the architecture of the Node.js / Express backend, mapping out exactly what each file, module, and database model is responsible for.

---

## 📂 Core Folder Structure

```text
server/
├── src/
│   ├── config/      # System configurations (DB connect, etc.)
│   ├── lib/         # Third-party integrations & utilities
│   ├── models/      # Mongoose schemas (MongoDB)
│   ├── routes/      # Express API router controllers
│   └── server.js    # Entry point & Express server runner
└── README_MODULES.md# This document
```

---

## 🚀 Entry Point

### 📄 [server.js](file:///e:/Office%20Projects/admanager/server/src/server.js)
The core runner that initializes the application:
*   Loads environment variables (`.env`).
*   Establishes the MongoDB connection via `config/db.js`.
*   Configures global Express middlewares, including a **port-independent and local-network-friendly CORS configuration** that dynamically allows requests from any port on `localhost` (`127.0.0.1`) and local networks (`192.168.*`, `172.*`, `10.*`).
*   Mounts API endpoints under `/api/auth`, `/api/meta`, and `/api/shopify`.
*   Starts the HTTP listener (defaulting to Port `5001`).

---

## ⚙️ Configuration Module

### 📄 [config/db.js](file:///e:/Office%20Projects/admanager/server/src/config/db.js)
*   **Purpose**: Manages MongoDB connection life-cycle.
*   **Logic**: Connects to the URI specified by `MONGODB_URI` environment variable, handling errors and logging successful startup connection.

---

## 🛠️ Third-Party Integrations & Libraries (`src/lib`)

### 📄 [lib/metaApi.js](file:///e:/Office%20Projects/admanager/server/src/lib/metaApi.js)
The bridge between the backend and Facebook's Graph API:
*   **Concurrency Control**: Enforces an API rate-limiting queue (maximum 2 parallel requests with a 1500ms delay between calls) to prevent Meta `Error 17` (user rate limit reached).
*   **Data Aggregator**: Implements `fetchCompleteDashboard` which fetches campaigns, adsets, and ads, fetches creative copies (headlines/descriptions/destination URLs) in parallel batches, and fetches daily insights breakdowns.
*   **Pagination Handlers**: Automatically follows cursor links (`next` pages) returned from Meta's Graph API.

### 📄 [lib/constants.js](file:///e:/Office%20Projects/admanager/server/src/lib/constants.js) and [lib/apiConstants.js](file:///e:/Office%20Projects/admanager/server/src/lib/apiConstants.js)
*   Define global system constants, HTTP status codes, defaults (e.g. 4-hour TTL), and Facebook Graph API query fields (`CREATIVE_FIELDS`, `AD_INSIGHTS_FIELDS`).

---

## 🗄️ Database Models (`src/models`)

These files define the schemas and database indexes in MongoDB:

1.  **[Merchant.js](file:///e:/Office%20Projects/admanager/server/src/models/Merchant.js)**: Handles account links, active Shopify tokens, Meta tokens, and default currencies.
2.  **[CacheMarker.js](file:///e:/Office%20Projects/admanager/server/src/models/CacheMarker.js)**: Stores timestamps of when a specific data range was cached to verify if cached data is fresh (under 4 hours old).
3.  **[AdMetadata.js](file:///e:/Office%20Projects/admanager/server/src/models/AdMetadata.js)**: Stores the structural hierarchy of Meta Ads (Campaign -> Ad Set -> Ad) and creative visual copies.
4.  **[DailyAdInsight.js](file:///e:/Office%20Projects/admanager/server/src/models/DailyAdInsight.js)**: Caches daily performance metrics (spend, clicks, impressions) per Ad ID.
5.  **[ShopifyProduct.js](file:///e:/Office%20Projects/admanager/server/src/models/ShopifyProduct.js)**: Caches catalog items, titles, handles, and variant-level SKUs/stock quantities.
6.  **[ShopifyOrder.js](file:///e:/Office%20Projects/admanager/server/src/models/ShopifyOrder.js)**: Caches customer checkout orders, prices, and referrers for UTM attribution.
7.  **[AdProductMapping.js](file:///e:/Office%20Projects/admanager/server/src/models/AdProductMapping.js)**: Holds manually overriden mappings from Ads to Products.
8.  **[AttributionError.js](file:///e:/Office%20Projects/admanager/server/src/models/AttributionError.js)**: Caches warnings regarding unattributed orders.
9.  **[ProductDailyPerformance.js](file:///e:/Office%20Projects/admanager/server/src/models/ProductDailyPerformance.js)**: Stores historically computed product performance metrics.

---

## 📡 API Routing Controllers (`src/routes`)

These define the Express HTTP endpoints exposed to the frontend client:

### 📄 [routes/auth.js](file:///e:/Office%20Projects/admanager/server/src/routes/auth.js)
*   Exposes endpoints to exchange Meta OAuth short-lived access tokens for long-lived (60 days) access tokens.
*   Authenticates and saves credentials to the active `Merchant` record.

### 📄 [routes/meta.js](file:///e:/Office%20Projects/admanager/server/src/routes/meta.js)
*   **`GET /api/meta`**: Loads the structure and insights dashboard metrics. Checks cached markers: if valid (under 4 hours), returns from MongoDB instantly. If expired, queries `lib/metaApi.js`, caches the records in MongoDB, and updates the CacheMarker.
*   Handles nested detail loaders (`campaigns`, `adsets`, `ads`) and supports paginated scroll updates.

### 📄 [routes/shopify.js](file:///e:/Office%20Projects/admanager/server/src/routes/shopify.js)
*   **`GET /api/shopify?type=products`**: Fetches and caches inventory products.
*   **`GET /api/shopify?type=orders`**: Fetches and caches shop order transaction logs.
*   **`GET /api/shopify?type=performance`**: 
    1.  Downloads and caches Shopify products (with variant SKUs) and Shopify orders for the date range.
    2.  Pulls Meta ads and daily insights from MongoDB.
    3.  Runs the **Ad-to-Product Matching** engine.
    4.  Runs the **Shopify Order Attribution** processor.
    5.  Aggregates spends, clicks, stock levels, conversions, and True/Meta ROAS.
    6.  Sends the clean, pre-calculated array directly to the client.
*   **`GET /api/shopify/reset-db`**: Safely clears all cache collections in MongoDB to allow starting from scratch.
