// test-teams-permissions.js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function getAccessToken() {
  try {
    console.log("🔑 Getting access token...");
    const response = await axios.post(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Error getting access token:", error.response?.data || error.message);
    return null;
  }
}

async function testTeamsPermissions() {
  const token = await getAccessToken();
  if (!token) {
    console.log("❌ Could not get access token");
    return;
  }

  const userId = "admin@thrivebrands.ai";
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log("\n🧪 Testing Teams permissions for:", userId);

  // Test 1: Get user details
  try {
    console.log("\n1️⃣ Testing user details...");
    const userResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userId}`,
      { headers }
    );
    console.log("✅ User found:", userResponse.data.displayName);
    console.log("   User ID:", userResponse.data.id);
    console.log("   User Principal Name:", userResponse.data.userPrincipalName);
  } catch (error) {
    console.log("❌ User not found:", error.response?.status, error.response?.data?.error?.message);
  }

  // Test 2: Get user licenses
  try {
    console.log("\n2️⃣ Testing user licenses...");
    const licensesResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userId}/assignedLicenses`,
      { headers }
    );
    console.log("✅ Licenses found:", licensesResponse.data.value.length);
    licensesResponse.data.value.forEach(license => {
      console.log("   SKU ID:", license.skuId);
      console.log("   Disabled Plans:", license.disabledPlans?.length || 0);
    });
  } catch (error) {
    console.log("❌ Could not get licenses:", error.response?.status, error.response?.data?.error?.message);
  }

  // Test 3: Get user's Teams settings
  try {
    console.log("\n3️⃣ Testing Teams settings...");
    const teamsResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userId}/teamwork`,
      { headers }
    );
    console.log("✅ Teams settings found:", teamsResponse.data);
  } catch (error) {
    console.log("❌ Could not get Teams settings:", error.response?.status, error.response?.data?.error?.message);
  }

  // Test 4: Try to create a meeting with different endpoints
  console.log("\n4️⃣ Testing meeting creation...");
  
  const meetingData = {
    subject: "Test Meeting",
    startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    endDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    participants: {
      attendees: []
    }
  };

  const endpoints = [
    {
      name: "v1.0 /users/{userId}/onlineMeetings",
      url: `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings`
    },
    {
      name: "beta /users/{userId}/onlineMeetings", 
      url: `https://graph.microsoft.com/beta/users/${userId}/onlineMeetings`
    },
    {
      name: "v1.0 /communications/calls",
      url: `https://graph.microsoft.com/v1.0/communications/calls`,
      data: {
        "@odata.type": "#microsoft.graph.call",
        "callbackUri": "https://bot.contoso.com/callback",
        "source": {
          "@odata.type": "#microsoft.graph.participantInfo",
          "identity": {
            "@odata.type": "#microsoft.graph.identitySet",
            "application": {
              "@odata.type": "#microsoft.graph.identity",
              "id": process.env.CLIENT_ID
            }
          }
        },
        "targets": [],
        "requestedModalities": ["audio", "video"]
      }
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n   Testing: ${endpoint.name}`);
      const response = await axios.post(
        endpoint.url,
        endpoint.data || meetingData,
        { headers }
      );
      console.log(`   ✅ Success! Meeting ID: ${response.data.id}`);
      
      // Clean up
      if (response.data.id && !endpoint.url.includes('communications')) {
        await axios.delete(
          `${endpoint.url}/${response.data.id}`,
          { headers }
        );
        console.log(`   🧹 Cleaned up test meeting`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Test 5: Check if user has Teams app installed
  try {
    console.log("\n5️⃣ Testing Teams app installation...");
    const appsResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userId}/teamwork/installedApps`,
      { headers }
    );
    console.log("✅ Teams apps found:", appsResponse.data.value.length);
    appsResponse.data.value.forEach(app => {
      console.log("   App:", app.teamsApp?.displayName || app.id);
    });
  } catch (error) {
    console.log("❌ Could not get Teams apps:", error.response?.status, error.response?.data?.error?.message);
  }
}

testTeamsPermissions().catch(console.error);
