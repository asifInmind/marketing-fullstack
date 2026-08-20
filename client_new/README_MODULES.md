# Frontend Module Reference Guide (New Client)

This document explains the architecture of the new Next.js client (`client_new`), mapping out exactly what each directory, page route, UI component, and custom hook is responsible for.

---

## 📂 Core Folder Structure

```text
client_new/
├── public/          # Static assets (images, logos, icons)
├── src/
│   ├── app/         # Next.js App Router (Layouts, page entry points)
│   ├── components/  # Material UI components
│   │   ├── meta/    # Meta-attributor specific widgets
│   │   └── mui/     # Custom Material UI overrides (e.g. Avator.jsx)
│   └── lib/         # Business logic layer
│       ├── api/     # Backend fetching hooks/utilities
│       ├── hooks/   # React state-fetching custom hooks
│       └── utils/   # Normalization, constants, and math calculators
├── package.json     # Node dependencies & project scripts
└── README_MODULES.md# This document
```

---

## 🚀 Entry Point & Router Layout (`src/app`)

### 📄 [layout.js](file:///e:/Office%20Projects/admanager/client_new/src/app/layout.js)
The main wrapper template for all pages in the app:
*   Imports global styling (`globals.css`) and loads modern Google fonts (Geist Sans / Geist Mono).
*   Registers the **Facebook Pixel Script** with `afterInteractive` priority to avoid slowing down first page loads.
*   Wraps children with `<Providers>` to supply Material UI `ThemeProvider` tokens and `<CssBaseline>` resets.
*   Includes a **Console Interceptor** script in the `<head>` that filters out Emotion's `:first-child` SSR warnings, keeping browser error overlays clean.

### 📄 [page.js](file:///e:/Office%20Projects/admanager/client_new/src/app/page.js)
*   **Purpose**: Mounts the main portal landing workspace.
*   **Logic**: Uses a client-side `useEffect` mount-guard check to delay rendering of the login page until hydration completes. This bypasses server-vs-client markup mismatches.

### 📄 [(pages)/homePage/page.jsx](file:///e:/Office%20Projects/admanager/client_new/src/app/%28pages%29/homePage/page.jsx)
*   **Purpose**: Credentials verification and OAuth token exchange.
*   **Logic**: 
    1.  Prompts the user to enter their Meta access token and Ad Account ID.
    2.  Verifies the credentials and exchanges the short-lived token for a **60-day long-lived token** via the backend.
    3.  Stores successful credentials inside the browser's `localStorage` for automatic login on subsequent visits.
    4.  Redirects the user to the dashboard Choice view page.

### 📄 [(pages)/choice/[accountID]/page.jsx](file:///e:/Office%20Projects/admanager/client_new/src/app/%28pages%29/choice/%255BaccountID%255D/page.jsx)
*   **Purpose**: Dynamic Campaign router (`/choice/[accountID]?access_token=...`).
*   **Logic**: Retrieves the active account parameters from the URL route and mounts the main dashboard component (`MetaDashboard`) inside a loading `<Suspense>` boundary.

---

## 🎨 Dashboard UI Components (`src/components/meta`)

### 📄 [MetaDashboard.jsx](file:///e:/Office%20Projects/admanager/client_new/src/components/meta/MetaDashboard.jsx)
The primary coordinate wrapper for the analytics app workspace:
*   Initializes filters for the date range picker (Preset relative filters vs custom date calendars).
*   Manages active view tabs (`campaigns`, `adsets`, `ads`, `shopify`).
*   Loads state streams from custom hooks `useMetaDashboard` and `useShopifyDashboard`.
*   Includes action buttons to connect/disconnect Shopify stores.

### 📄 [MetaDynamicTable.jsx](file:///e:/Office%20Projects/admanager/client_new/src/components/meta/MetaDynamicTable.jsx)
A central table engine built using **TanStack Table (`@tanstack/react-table`)**:
*   Replaces legacy, standalone table components (`MetaCampaignTable.jsx`, `MetaAdSetTable.jsx`, `MetaAdTable.jsx`) to consolidate display configurations into one file.
*   Dynamically switches column headers, data parsing, sorting, filtering, and cell render overrides depending on the active tab key.
*   Highlights cell alerts, CTR percentages, status chips, and handles column links.

### 📄 [MetaMetricCards.jsx](file:///e:/Office%20Projects/admanager/client_new/src/components/meta/MetaMetricCards.jsx)
Renders the grid-cards showing high-level marketing statistics:
*   Supports three distinct display configurations:
    1.  `meta`: Shows direct Meta Pixel data (Spend, Clicks, Impressions, Conversions, ROAS).
    2.  `shopify`: Shows direct Meta-attributed Shopify store transactions (Sales, Orders, unique buyers, AOV, ROAS).
    3.  `comparison`: Renders side-by-side values (Meta vs Shopify) to highlight tracking discrepancies.

### 📄 [MetaProductAuditDrawer.jsx](file:///e:/Office%20Projects/admanager/client_new/src/components/meta/MetaProductAuditDrawer.jsx)
The slide-out drawer that opens when clicking a product in the Shopify performance tab:
*   Audits attribution data for a single product (Pixel revenue vs. Shopify orders).
*   Lists all **connected campaigns, adsets, and ads** mapping to this product.
*   Includes a **Daily Ad Spend Timeline** table showing detailed cost history.
*   Displays warning messages if budget is being spent on out-of-stock inventory, or if active ads are frozen (have stopped spending).

### 📄 [MetaCampaignDetail.jsx](file:///e:/Office%20Projects/admanager/client_new/src/components/meta/MetaCampaignDetail.jsx) & [MetaAdSetDetail.jsx](file:///e:/Office%20Projects/admanager/client_new/src/components/meta/MetaAdSetDetail.jsx)
Drill-down views shown when clicking a campaign or ad set in the tables:
*   Displays selected metadata sub-headers (total cost, conversions, optimization goals).
*   Loads filtered sub-tables of children (e.g. adsets inside the campaign, or ads inside the adset).

---

## ⚙️ Logic, Hooks & Data Flows (`src/lib`)

### 📄 [lib/hooks/useMetaDashboard.js](file:///e:/Office%20Projects/admanager/client_new/src/lib/hooks/useMetaDashboard.js)
State-fetcher that pulls data directly from the Express backend:
*   **Step 1:** Fetches overall structural campaign groupings.
*   **Step 2:** Progressively fetches pages of ad insights, loading daily breakdowns and creatives in the background to avoid timeouts.
*   Points directly to `process.env.NEXT_PUBLIC_BACKEND_URL` to bypass Next.js rewrites and avoid proxy socket hang-ups.

### 📄 [lib/hooks/useShopifyDashboard.js](file:///e:/Office%20Projects/admanager/client_new/src/lib/hooks/useShopifyDashboard.js)
Pulls order-matching and product calculations:
*   Requests Shopify product indexes and payment transactions.
*   Triggers non-blocking background sync commands on the Express server to calculate attribution models.

### 📄 [lib/utils/metaTransformers.js](file:///e:/Office%20Projects/admanager/client_new/src/lib/utils/metaTransformers.js)
Data-normalization utility functions:
*   Calculates ROAS math (`revenue / spend`).
*   Standardizes raw API responses from the server to ensure campaign, adset, and ad objects expose uniform values (`cost`, `conversions`, `conversionValue`, `roas`).

### 📄 [lib/utils/constants.js](file:///e:/Office%20Projects/admanager/client_new/src/lib/utils/constants.js)
*   Defines date ranges (7 days, 30 days, 90 days, custom), mapping names, status layouts, and global system defaults.
