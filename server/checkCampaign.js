import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import AdMetadata from './src/models/AdMetadata.js';
import DailyAdInsight from './src/models/DailyAdInsight.js';
import ShopifyOrder from './src/models/ShopifyOrder.js';

const campaignIdToCheck = process.argv[2] || '120207936532450331';

async function checkCampaign() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/addmanager';
  console.log(`\nConnecting to database at ${uri}...`);
  await mongoose.connect(uri);

  console.log(`\n======================================================`);
  console.log(`🔍 DIAGNOSTIC REPORT FOR CAMPAIGN: ${campaignIdToCheck}`);
  console.log(`======================================================\n`);

  // 1. Fetch AdMetadata
  const metadataList = await AdMetadata.find({ campaignId: campaignIdToCheck });
  
  if (metadataList.length === 0) {
    console.log(`⚠️ No AdMetadata records found for campaignId: ${campaignIdToCheck}`);
  } else {
    const campaignName = metadataList[0]?.campaignName || 'Unknown';
    const storeUrl = metadataList[0]?.storeUrl || 'Unknown';
    const campaignStatus = metadataList[0]?.campaignStatus || '(Not set / empty)';
    
    console.log(`📌 Store: ${storeUrl}`);
    console.log(`📌 Campaign Name: ${campaignName}`);
    console.log(`📌 Campaign Status Field: ${campaignStatus}`);
    console.log(`📌 Total Ads in Campaign: ${metadataList.length}\n`);

    // Ad Sets & Ads summary
    console.log(`--- Ads & Ad Sets Status Breakdown ---`);
    const adIds = [];
    const adSetMap = {};

    metadataList.forEach(m => {
      if (m.adId) adIds.push(m.adId);
      const setKey = m.adSetId || 'Unknown AdSet';
      if (!adSetMap[setKey]) {
        adSetMap[setKey] = {
          name: m.adSetName || 'Unnamed AdSet',
          status: m.adSetStatus || 'N/A',
          ads: []
        };
      }
      adSetMap[setKey].ads.push({
        adId: m.adId,
        name: m.adName,
        status: m.adStatus || 'N/A'
      });
    });

    Object.entries(adSetMap).forEach(([setId, data]) => {
      console.log(`\n📁 AdSet [${setId}] - "${data.name}" | Status: ${data.status.toUpperCase()}`);
      data.ads.forEach(a => {
        console.log(`   └─ Ad [${a.adId}] "${a.name}" | Status: ${a.status.toUpperCase()}`);
      });
    });

    // 2. Fetch DailyAdInsight spend & activity
    console.log(`\n------------------------------------------------------`);
    console.log(`📊 Spend & Insights Activity:`);

    const insights = await DailyAdInsight.find({ adId: { $in: adIds } }).sort({ date: -1 });

    if (insights.length === 0) {
      console.log(`⚠️ No DailyAdInsight records found for this campaign's ads.`);
    } else {
      let totalSpend = 0;
      let totalClicks = 0;
      let totalImpressions = 0;
      let spendLast7Days = 0;
      let spendLast30Days = 0;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const latestInsight = insights[0];

      insights.forEach(ins => {
        const spend = ins.spend || 0;
        totalSpend += spend;
        totalClicks += ins.clicks || 0;
        totalImpressions += ins.impressions || 0;

        const d = new Date(ins.date);
        if (d >= sevenDaysAgo) spendLast7Days += spend;
        if (d >= thirtyDaysAgo) spendLast30Days += spend;
      });

      console.log(`   • Total Recorded Spend: $${totalSpend.toFixed(2)} (or PKR ${totalSpend.toLocaleString()})`);
      console.log(`   • Total Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`   • Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`   • Spend in Last 7 Days: $${spendLast7Days.toFixed(2)}`);
      console.log(`   • Spend in Last 30 Days: $${spendLast30Days.toFixed(2)}`);
      console.log(`   • Latest Spend / Activity Date: ${latestInsight.date?.toISOString().split('T')[0] || 'N/A'}`);
    }
  }

  // 3. Matched Orders
  console.log(`\n------------------------------------------------------`);
  console.log(`🛍️ Matched Shopify Orders:`);

  const matchedOrders = await ShopifyOrder.find({
    $or: [
      { 'attribution.campaignId': campaignIdToCheck },
      { 'attribution.utmCampaign': campaignIdToCheck },
      { 'customerJourney.firstVisit.utmCampaign': campaignIdToCheck },
      { 'customerJourney.lastVisit.utmCampaign': campaignIdToCheck }
    ]
  }).sort({ createdAt: -1 });

  const totalRevenue = matchedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const currency = matchedOrders[0]?.currency || 'PKR';

  console.log(`   • Total Orders Matched: ${matchedOrders.length}`);
  console.log(`   • Total Attributed Revenue: ${currency} ${totalRevenue.toLocaleString()}`);
  if (matchedOrders.length > 0) {
    console.log(`   • Most Recent Order: #${matchedOrders[0].orderNumber} on ${matchedOrders[0].createdAt?.toISOString().split('T')[0]}`);
    console.log(`   • Oldest Order: #${matchedOrders[matchedOrders.length - 1].orderNumber} on ${matchedOrders[matchedOrders.length - 1].createdAt?.toISOString().split('T')[0]}`);
  }

  console.log(`\n======================================================\n`);
  await mongoose.disconnect();
}

checkCampaign().catch(err => {
  console.error('Error running checkCampaign:', err);
  mongoose.disconnect();
  process.exit(1);
});
