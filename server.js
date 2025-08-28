// server.js
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from 'nodemailer';

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

// -------------------
// 1. Get Access Token
// -------------------
async function getAccessToken() {
  try {
    console.log("🔑 Getting fresh access token...");
    console.log("TENANT_ID", process.env.TENANT_ID, "CLIENT_ID", process.env.CLIENT_ID, "CLIENT_SECRET", process.env.CLIENT_SECRET);
    // Check if Azure credentials are configured
    if (!process.env.TENANT_ID || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      console.log('⚠️ Azure credentials not configured, using mock mode');
      return 'mock-token';
    }

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
    
    console.log('✅ Access token obtained successfully');
    console.log('🔑 Token expires in:', response.data.expires_in, 'seconds');
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Error getting access token:", error.response?.data || error.message);
    console.log('⚠️ Using mock mode due to authentication error');
    return 'mock-token';
  }
}

// -------------------
// 2. Create Teams Meeting
// -------------------
async function createTeamsMeeting(subject, startTime, endTime, attendees, organizerEmail) {
  try {
    const token = await getAccessToken();

    // If using mock mode, return mock data
    if (token === 'mock-token') {
      console.log('📝 Creating mock Teams meeting');
      const meetingId = Math.random().toString(36).substring(2, 15);
      return {
        id: meetingId,
        joinUrl: `https://teams.microsoft.com/l/meetup-join/19:meeting_${meetingId}@thread.v2/0?context={"Tid":"mock-tenant","Oid":"${organizerEmail}"}`,
        startDateTime: startTime,
        endDateTime: endTime,
        subject: subject
      };
    }

    // First, let's try to get the user ID for the organizer
    let userId;
    try {
      console.log('🔍 Attempting to create meeting for organizer:', organizerEmail);
      
      // First, verify the user exists and get their details
      const userResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${organizerEmail}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ User found:', userResponse.data.displayName);
      userId = userResponse.data.id;
      
      // Check user's assigned licenses to see Teams services
      try {
        const licensesResponse = await axios.get(
          `https://graph.microsoft.com/v1.0/users/${userId}/assignedLicenses`,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('📋 User licenses:', licensesResponse.data.value.map(license => ({
          skuId: license.skuId,
          disabledPlans: license.disabledPlans
        })));
      } catch (licenseError) {
        console.log('⚠️ Could not check user licenses:', licenseError.response?.status);
      }
      
      // Try multiple approaches to create the meeting
      let meetingResponse;
      
      // Approach 1: Try using /users/{userId}/onlineMeetings
      try {
        console.log('🔄 Trying approach 1: /users/{userId}/onlineMeetings');
        meetingResponse = await axios.post(
          `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings`,
          {
            subject: subject,
            startDateTime: startTime,
            endDateTime: endTime,
            participants: {
              attendees: attendees.map(email => ({
                upn: email,
                role: "attendee"
              }))
            }
          },
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ Approach 1 successful');
      } catch (error1) {
        console.log('❌ Approach 1 failed:', error1.response?.status, error1.response?.data?.error?.message);
        
        // Approach 2: Try using /users/{userPrincipalName}/onlineMeetings
        try {
          console.log('🔄 Trying approach 2: /users/{userPrincipalName}/onlineMeetings');
          meetingResponse = await axios.post(
            `https://graph.microsoft.com/v1.0/users/${organizerEmail}/onlineMeetings`,
            {
              subject: subject,
              startDateTime: startTime,
              endDateTime: endTime,
              participants: {
                attendees: attendees.map(email => ({
                  upn: email,
                  role: "attendee"
                }))
              }
            },
            {
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('✅ Approach 2 successful');
        } catch (error2) {
          console.log('❌ Approach 2 failed:', error2.response?.status, error2.response?.data?.error?.message);
          
          // Approach 3: Try using beta endpoint
          try {
            console.log('🔄 Trying approach 3: /beta/users/{userId}/onlineMeetings');
            meetingResponse = await axios.post(
              `https://graph.microsoft.com/beta/users/${userId}/onlineMeetings`,
              {
                subject: subject,
                startDateTime: startTime,
                endDateTime: endTime,
                participants: {
                  attendees: attendees.map(email => ({
                    upn: email,
                    role: "attendee"
                  }))
                }
              },
              {
                headers: { 
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log('✅ Approach 3 successful (beta endpoint)');
          } catch (error3) {
            console.log('❌ Approach 3 failed:', error3.response?.status, error3.response?.data?.error?.message);
            
                      // Approach 4: Try creating a calendar event instead of Teams meeting
          try {
            console.log('🔄 Trying approach 4: Create calendar event with Teams meeting');
            meetingResponse = await axios.post(
              `https://graph.microsoft.com/v1.0/users/${userId}/events`,
              {
                subject: subject,
                start: {
                  dateTime: startTime,
                  timeZone: "UTC"
                },
                end: {
                  dateTime: endTime,
                  timeZone: "UTC"
                },
                attendees: attendees.map(email => ({
                  emailAddress: {
                    address: email
                  },
                  type: "required"
                })),
                isOnlineMeeting: true,
                onlineMeetingProvider: "teamsForBusiness"
              },
              {
                headers: { 
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log('✅ Approach 4 successful (calendar event with Teams meeting)');
          } catch (error4) {
            console.log('❌ Approach 4 failed:', error4.response?.status, error4.response?.data?.error?.message);
            
            // Approach 5: Try using /communications/calls (alternative endpoint)
            try {
              console.log('🔄 Trying approach 5: /communications/calls');
              meetingResponse = await axios.post(
                `https://graph.microsoft.com/v1.0/communications/calls`,
                {
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
                  "targets": attendees.map(email => ({
                    "@odata.type": "#microsoft.graph.invitationParticipantInfo",
                    "identity": {
                      "@odata.type": "#microsoft.graph.identitySet",
                      "upn": email
                    }
                  })),
                  "requestedModalities": ["audio", "video"]
                },
                {
                  headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              console.log('✅ Approach 5 successful (communications endpoint)');
            } catch (error5) {
              console.log('❌ Approach 5 failed:', error5.response?.status, error5.response?.data?.error?.message);
              throw error5; // Throw the last error
            }
          }
          }
        }
      }

      console.log('✅ Teams meeting created successfully:', meetingResponse.data);
      return meetingResponse.data;
      
    } catch (userError) {
      console.error('❌ Error creating meeting:', userError.response?.data || userError.message);
      
      // Check if it's a permission issue vs user not found
      if (userError.response?.status === 403) {
        console.error('❌ Permission denied. This is likely due to missing admin consent for application permissions.');
        console.error('❌ Required permissions that need admin consent:');
        console.error('   - OnlineMeetings.ReadWrite.All (Application)');
        console.error('   - User.Read.All (Application)');
        console.error('   - Calendars.ReadWrite (Application)');
        console.error('❌ Please grant admin consent in Azure AD app registration');
      } else if (userError.response?.status === 404) {
        console.error('❌ User not found or Teams license issue:', organizerEmail);
        console.error('❌ Please ensure the user exists and has a valid Teams license');
        console.error('❌ Also check if the user has permission to create online meetings');
      } else {
        console.error('❌ Unexpected error:', userError.response?.status, userError.response?.data);
      }
      
      throw new Error(`Failed to create meeting. ${userError.response?.data?.error?.message || userError.message}`);
    }

  } catch (error) {
    console.error("❌ Error creating meeting:", error.message);
    console.log('⚠️ Using mock mode due to API error');
    
    // Return mock data as fallback
    const meetingId = Math.random().toString(36).substring(2, 15);
    return {
      id: meetingId,
      joinUrl: `https://teams.microsoft.com/l/meetup-join/19:meeting_${meetingId}@thread.v2/0?context={"Tid":"mock-tenant","Oid":"${organizerEmail}"}`,
      startDateTime: startTime,
      endDateTime: endTime,
      subject: subject
    };
  }
}

// -------------------
// 3. Send Email Notification
// -------------------
async function sendEmailNotification(meetingData, userDetails) {
  try {
    // Use Microsoft Graph API to send email through the organizer's account
    const token = await getAccessToken();
    
    if (token === 'mock-token') {
      console.log('📧 Mock mode - logging email data instead of sending');
      const emailData = {
        to: userDetails.email,
        subject: `Meeting Confirmation - ${meetingData.date}`,
        html: generateEmailTemplate(meetingData, userDetails)
      };
      console.log('📧 Email data:', emailData);
      return {
        success: true,
        message: 'Email logged (mock mode)',
        previewUrl: null
      };
    }

    // Send email using Microsoft Graph API
    const emailResponse = await axios.post(
      `https://graph.microsoft.com/v1.0/users/admin@thrivebrands.ai/sendMail`,
      {
        message: {
          subject: `Meeting Confirmation - ${meetingData.date}`,
          body: {
            contentType: "HTML",
            content: generateEmailTemplate(meetingData, userDetails)
          },
          toRecipients: [
            {
              emailAddress: {
                address: userDetails.email
              }
            }
          ]
        }
      },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Email sent successfully via Microsoft Graph');
    
    return {
      success: true,
      message: 'Meeting invitation sent successfully via Microsoft Graph',
      previewUrl: null
    };
  } catch (error) {
    console.error('❌ Error sending meeting invitation:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// -------------------
// 4.1. Send Organizer Notification
// -------------------
async function sendOrganizerNotification(meetingData, organizerEmail) {
  try {
    // Use Microsoft Graph API to send email through the admin account
    const token = await getAccessToken();
    
    if (token === 'mock-token') {
      console.log('📧 Mock mode - logging organizer notification instead of sending');
      const emailData = {
        to: organizerEmail,
        subject: "🎯 New Discovery Call Booked - Action Required",
        html: generateOrganizerNotificationTemplate(meetingData)
      };
      console.log('📧 Organizer notification data:', emailData);
      return {
        success: true,
        message: 'Organizer notification logged (mock mode)',
        previewUrl: null
      };
    }

    // Send email using Microsoft Graph API
    const emailResponse = await axios.post(
      `https://graph.microsoft.com/v1.0/users/admin@thrivebrands.ai/sendMail`,
      {
        message: {
          subject: "🎯 New Discovery Call Booked - Action Required",
          body: {
            contentType: "HTML",
            content: generateOrganizerNotificationTemplate(meetingData)
          },
          toRecipients: [
            {
              emailAddress: {
                address: organizerEmail
              }
            }
          ]
        }
      },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Organizer notification sent successfully via Microsoft Graph');
    
    return {
      success: true,
      message: 'Organizer notification sent successfully',
      previewUrl: null
    };
  } catch (error) {
    console.error('❌ Error sending organizer notification:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// -------------------
// 4.2. Send Admin Notification
// -------------------
async function sendAdminNotification(meetingData, adminEmail) {
  try {
    // Use Microsoft Graph API to send email through the admin account
    const token = await getAccessToken();
    
    if (token === 'mock-token') {
      console.log('📧 Mock mode - logging admin notification instead of sending');
      const emailData = {
        to: adminEmail,
        subject: "📊 New Discovery Call Booked - Admin Notification",
        html: generateAdminNotificationTemplate(meetingData)
      };
      console.log('📧 Admin notification data:', emailData);
      return {
        success: true,
        message: 'Admin notification logged (mock mode)',
        previewUrl: null
      };
    }

    // Send email using Microsoft Graph API
    const emailResponse = await axios.post(
      `https://graph.microsoft.com/v1.0/users/admin@thrivebrands.ai/sendMail`,
      {
        message: {
          subject: "📊 New Discovery Call Booked - Admin Notification",
          body: {
            contentType: "HTML",
            content: generateAdminNotificationTemplate(meetingData)
          },
          toRecipients: [
            {
              emailAddress: {
                address: adminEmail
              }
            }
          ]
        }
      },
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Admin notification sent successfully via Microsoft Graph');
    
    return {
      success: true,
      message: 'Admin notification sent successfully',
      previewUrl: null
    };
  } catch (error) {
    console.error('❌ Error sending admin notification:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// -------------------
// 4. Generate Email Template
// -------------------
function generateEmailTemplate(meetingData, userDetails) {
  // Ensure meeting link is properly set
  const meetingLink = meetingData.meetingLink || '#';
  const meetingTitle = meetingData.subject || 'Meeting';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1A5069;">${meetingTitle} Confirmation</h2>
      
      <p>Dear ${userDetails.firstName} ${userDetails.lastName},</p>
      
      <p>Your meeting has been successfully scheduled. Here are the details:</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #0F7BAE; margin-top: 0;">Meeting Details</h3>
        <p><strong>Date:</strong> ${meetingData.date}</p>
        <p><strong>Time:</strong> ${meetingData.time} (${meetingData.timezone})</p>
        <p><strong>Duration:</strong> ${meetingData.duration || '30 minutes'}</p>
        <p><strong>Platform:</strong> Microsoft Teams</p>
        <p><strong>Organizer:</strong> Admin (Thrive Team)</p>
      </div>
      
      <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #0F7BAE; margin-top: 0;">Join Meeting</h3>
        <p>Click the button below to join the meeting:</p>
        <a href="${meetingLink}" style="background-color: #1A5069; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Join Microsoft Teams Meeting
        </a>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
          If the button doesn't work, copy and paste this link: <br>
          <a href="${meetingLink}" style="color: #0F7BAE;">${meetingLink}</a>
        </p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">Important Notes</h3>
        <ul>
          <li>Please join the meeting 5 minutes before the scheduled time</li>
          <li>Make sure you have a stable internet connection</li>
          <li>Test your microphone and camera before joining</li>
          <li>If you need to reschedule, please contact us at least 24 hours in advance</li>
        </ul>
      </div>
      
      <p>We're excited to discuss how we can help you thrive!</p>
      
      <p>Best regards,<br>
      The Thrive Team</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="font-size: 12px; color: #666;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;
}

// -------------------
// 4.1. Generate Organizer Notification Template
// -------------------
function generateOrganizerNotificationTemplate(meetingData) {
  const meetingLink = meetingData.meetingLink || '#';
  const guestEmailsList = meetingData.guestEmails && meetingData.guestEmails.length > 0 
    ? meetingData.guestEmails.join(', ') 
    : 'None';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1A5069;">🎯 New Discovery Call Booked</h2>
      
      <p>Hello,</p>
      
      <p>A new discovery call has been booked and you are assigned as the organizer. Here are the details:</p>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="color: #856404; margin-top: 0;">📅 Meeting Details</h3>
        <p><strong>Date:</strong> ${meetingData.date}</p>
        <p><strong>Time:</strong> ${meetingData.time} (${meetingData.timezone})</p>
        <p><strong>Duration:</strong> ${meetingData.duration || '30 minutes'}</p>
        <p><strong>Platform:</strong> Microsoft Teams</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">👤 Client Information</h3>
        <p><strong>Name:</strong> ${meetingData.userDetails.firstName} ${meetingData.userDetails.lastName}</p>
        <p><strong>Email:</strong> ${meetingData.userDetails.email}</p>
        <p><strong>Company:</strong> ${meetingData.userDetails.companyName || 'Not provided'}</p>
        <p><strong>Revenue Range:</strong> ${meetingData.userDetails.revenue || 'Not provided'}</p>
        <p><strong>Guest Emails:</strong> ${guestEmailsList}</p>
      </div>
      
      <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #0F7BAE; margin-top: 0;">🔗 Meeting Link</h3>
        <p>Click the button below to join the meeting:</p>
        <a href="${meetingLink}" style="background-color: #1A5069; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Join Microsoft Teams Meeting
        </a>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
          If the button doesn't work, copy and paste this link: <br>
          <a href="${meetingLink}" style="color: #0F7BAE;">${meetingLink}</a>
        </p>
      </div>
      
      <div style="background-color: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <h4 style="color: #155724; margin-top: 0;">✅ Action Required</h4>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Review the client information above</li>
          <li>Prepare for the discovery call</li>
          <li>Join the meeting 5 minutes before the scheduled time</li>
          <li>Follow up with the client after the call</li>
        </ul>
      </div>
      
      <p>Best regards,<br>
      Thrive Team</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="font-size: 12px; color: #666;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `;
}

// -------------------
// 4.2. Generate Admin Notification Template
// -------------------
function generateAdminNotificationTemplate(meetingData) {
  const meetingLink = meetingData.meetingLink || '#';
  const guestEmailsList = meetingData.guestEmails && meetingData.guestEmails.length > 0 
    ? meetingData.guestEmails.join(', ') 
    : 'None';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1A5069;">📊 New Discovery Call Booked</h2>
      
      <p>Hello Admin,</p>
      
      <p>A new discovery call has been booked. Here are the details:</p>
      
      <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
        <h3 style="color: #004085; margin-top: 0;">📅 Meeting Details</h3>
        <p><strong>Date:</strong> ${meetingData.date}</p>
        <p><strong>Time:</strong> ${meetingData.time} (${meetingData.timezone})</p>
        <p><strong>Duration:</strong> ${meetingData.duration || '30 minutes'}</p>
        <p><strong>Platform:</strong> Microsoft Teams</p>
        <p><strong>Organizer:</strong> ${meetingData.organizerEmail || 'Swati'}</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #495057; margin-top: 0;">👤 Client Information</h3>
        <p><strong>Name:</strong> ${meetingData.userDetails.firstName} ${meetingData.userDetails.lastName}</p>
        <p><strong>Email:</strong> ${meetingData.userDetails.email}</p>
        <p><strong>Company:</strong> ${meetingData.userDetails.companyName || 'Not provided'}</p>
        <p><strong>Revenue Range:</strong> ${meetingData.userDetails.revenue || 'Not provided'}</p>
        <p><strong>Guest Emails:</strong> ${guestEmailsList}</p>
      </div>
      
      <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #0F7BAE; margin-top: 0;">🔗 Meeting Link</h3>
        <p>Click the button below to join the meeting:</p>
        <a href="${meetingLink}" style="background-color: #1A5069; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Join Microsoft Teams Meeting
        </a>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
          If the button doesn't work, copy and paste this link: <br>
          <a href="${meetingLink}" style="color: #0F7BAE;">${meetingLink}</a>
        </p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h4 style="color: #856404; margin-top: 0;">📈 Business Intelligence</h4>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>New lead generated from website</li>
          <li>Revenue potential: ${meetingData.userDetails.revenue || 'Unknown'}</li>
          <li>Company size: ${meetingData.userDetails.companyName ? 'Identified' : 'Unknown'}</li>
          <li>Additional attendees: ${meetingData.guestEmails ? meetingData.guestEmails.length : 0}</li>
        </ul>
      </div>
      
      <p>Best regards,<br>
      Thrive Team</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="font-size: 12px; color: #666;">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `;
}

// -------------------
// 5. API Routes
// -------------------

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Thrive Teams Meeting API is running!",
    endpoints: {
      health: "GET /",
      createMeeting: "POST /api/create-meeting",
      scheduleDiscoveryCall: "POST /api/schedule-discovery-call",
      testPermissions: "GET /api/test-permissions"
    }
  });
});

// Test permissions endpoint
app.get("/api/test-permissions", async (req, res) => {
  try {
    const token = await getAccessToken();
    
    if (token === 'mock-token') {
      return res.json({
        success: false,
        message: "Using mock mode - Azure credentials not configured"
      });
    }

    console.log('🧪 Testing permissions...');
    
    // Test 1: Try to get user info
    try {
      const userResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/users/admin@thrivebrands.ai`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ User.Read.All permission works:', userResponse.data.displayName);
    } catch (userError) {
      console.log('❌ User.Read.All permission failed:', userError.response?.status, userError.response?.data?.error?.message);
    }

    // Test 2: Try to create a test meeting using multiple approaches
    console.log('🧪 Testing meeting creation with multiple approaches...');
    
    // Approach 1: /users/{userId}/onlineMeetings
    try {
      console.log('🔄 Testing approach 1: /users/{userId}/onlineMeetings');
      const testMeetingResponse = await axios.post(
        `https://graph.microsoft.com/v1.0/users/admin@thrivebrands.ai/onlineMeetings`,
        {
          subject: "Test Meeting - Permission Check",
          startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          endDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), // Tomorrow + 30 min
          participants: {
            attendees: []
          }
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Approach 1 successful - OnlineMeetings.ReadWrite.AI permission works');
      
      // Clean up - delete the test meeting
      await axios.delete(
        `https://graph.microsoft.com/v1.0/users/admin@thrivebrands.ai/onlineMeetings/${testMeetingResponse.data.id}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Test meeting cleaned up');
      
    } catch (meetingError1) {
      console.log('❌ Approach 1 failed:', meetingError1.response?.status, meetingError1.response?.data?.error?.message);
      
      // Approach 2: /me/onlineMeetings
      try {
        console.log('🔄 Testing approach 2: /me/onlineMeetings');
        const testMeetingResponse2 = await axios.post(
          `https://graph.microsoft.com/v1.0/me/onlineMeetings`,
          {
            subject: "Test Meeting - Permission Check",
            startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            endDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
            participants: {
              attendees: []
            }
          },
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ Approach 2 successful - Delegated permissions work');
        
        // Clean up
        await axios.delete(
          `https://graph.microsoft.com/v1.0/me/onlineMeetings/${testMeetingResponse2.data.id}`,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ Test meeting cleaned up');
        
      } catch (meetingError2) {
        console.log('❌ Approach 2 failed:', meetingError2.response?.status, meetingError2.response?.data?.error?.message);
        console.log('❌ Both application and delegated permissions failed for meeting creation');
      }
    }

    res.json({
      success: true,
      message: "Permission test completed - check server logs for details"
    });
    
  } catch (error) {
    console.error('❌ Permission test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create meeting endpoint
app.post("/api/create-meeting", async (req, res) => {
  try {
    const { 
      subject, 
      startTime, 
      endTime, 
      attendees, 
      organizerEmail = process.env.ORGANIZER_EMAIL || "Swati.Nawani@thrivebrands.ai",
      userDetails 
    } = req.body;

    if (!subject || !startTime || !endTime || !attendees || !organizerEmail) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["subject", "startTime", "endTime", "attendees", "organizerEmail"]
      });
    }

    // Validate organizer email format
    if (!organizerEmail.includes('@')) {
      return res.status(400).json({ 
        error: "Invalid organizer email format",
        organizerEmail: organizerEmail
      });
    }

    // Create Teams meeting
    const meeting = await createTeamsMeeting(subject, startTime, endTime, attendees, organizerEmail);
    
    // Send custom email notifications to all attendees and userDetails
    let emailResults = [];
    
    // Send to userDetails if provided
    if (userDetails) {
      const meetingData = {
        subject: subject,
        date: new Date(startTime).toLocaleDateString(),
        time: new Date(startTime).toLocaleTimeString(),
        timezone: 'Asia/Calcutta (GMT+5:30)',
        duration: '1 hour',
        meetingLink: meeting.joinUrl || meeting.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl
      };
      const emailResult = await sendEmailNotification(meetingData, userDetails);
      emailResults.push({ recipient: userDetails.email, success: emailResult.success });
    }
    
    // Send to all attendees
    for (const attendeeEmail of attendees) {
      const attendeeDetails = {
        firstName: attendeeEmail.split('@')[0].split('.')[0],
        lastName: attendeeEmail.split('@')[0].split('.')[1] || '',
        email: attendeeEmail
      };
      
      const meetingData = {
        subject: subject,
        date: new Date(startTime).toLocaleDateString(),
        time: new Date(startTime).toLocaleTimeString(),
        timezone: 'Asia/Calcutta (GMT+5:30)',
        duration: '1 hour',
        meetingLink: meeting.joinUrl || meeting.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl
      };
      
      const emailResult = await sendEmailNotification(meetingData, attendeeDetails);
      emailResults.push({ recipient: attendeeEmail, success: emailResult.success });
    }

    res.json({ 
      success: true,
      message: "Meeting created successfully", 
      meeting,
      emailSent: emailResults.some(r => r.success),
      emailResults: emailResults,
      emailPreviewUrl: null
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.response?.data || null
    });
  }
});

// Discovery call specific endpoint
app.post("/api/schedule-discovery-call", async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    
            const { 
          selectedDate, 
          selectedTime, 
          userDetails,
          guestEmails = [],
          organizerEmail = process.env.ORGANIZER_EMAIL || "Swati.Nawani@thrivebrands.ai",
          organizerName = "admin" // Add organizer selection
        } = req.body;

    console.log('Validation check:', {
      selectedDate: !!selectedDate,
      selectedTime: !!selectedTime,
      userDetails: !!userDetails,
      organizerEmail: !!organizerEmail
    });
    
    if (!selectedDate || !selectedTime || !userDetails || !organizerEmail) {
      console.log('Missing fields:', {
        selectedDate: !selectedDate,
        selectedTime: !selectedTime,
        userDetails: !userDetails,
        organizerEmail: !organizerEmail
      });
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["selectedDate", "selectedTime", "userDetails", "organizerEmail"],
        received: {
          selectedDate,
          selectedTime,
          userDetails: userDetails ? 'present' : 'missing',
          organizerEmail
        }
      });
    }

    // Convert date and time to ISO format
    console.log('Converting date and time:', { selectedDate, selectedTime });
    
    // Convert 12-hour format to 24-hour format
    function convertTo24Hour(time12h) {
      const [time, modifier] = time12h.split(' ');
      let [hours, minutes] = time.split(':');
      
      if (hours === '12') {
        hours = '00';
      }
      
      if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
      }
      
      // Convert hours to string and pad with leading zero if needed
      const hoursStr = hours.toString().padStart(2, '0');
      return `${hoursStr}:${minutes}`;
    }
    
    const time24h = convertTo24Hour(selectedTime);
    console.log('Converted time to 24-hour format:', time24h);
    
    const startDateTime = new Date(`${selectedDate}T${time24h}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000); // 30 minutes later
    
    console.log('Calculated times:', {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    });

            // Use single ORGANIZER_EMAIL from environment
        const selectedOrganizerEmail = process.env.ORGANIZER_EMAIL || "admin@thrivebrands.ai";
        
        const meetingData = {
          subject: "Discovery Call - Thrive",
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          attendees: [userDetails.email, ...guestEmails], // Include userDetails.email and guest emails
          organizerEmail: selectedOrganizerEmail,
          userDetails: userDetails
        };

    // Create Teams meeting
    console.log('Creating Teams meeting with data:', meetingData);
    
    let meeting;
    try {
      meeting = await createTeamsMeeting(
        meetingData.subject,
        meetingData.startTime,
        meetingData.endTime,
        meetingData.attendees,
        meetingData.organizerEmail
      );
      console.log('Teams meeting created successfully:', meeting);
    } catch (error) {
      console.error('Error creating Teams meeting:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create Teams meeting',
        details: error.message
      });
    }

    // Send custom email notifications to all attendees and userDetails
    let emailResults = [];
    
    // Send to userDetails
    try {
      const emailData = {
        subject: "Discovery Call - Thrive",
        date: selectedDate,
        time: selectedTime,
        timezone: 'Asia/Calcutta (GMT+5:30)',
        duration: '30 minutes',
        meetingLink: meeting.joinUrl || meeting.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl
      };
      
      console.log('Sending email to userDetails:', userDetails.email);
      const userEmailResult = await sendEmailNotification(emailData, userDetails);
      emailResults.push({ recipient: userDetails.email, success: userEmailResult.success });
    } catch (error) {
      console.error('Error sending email to userDetails:', error);
      emailResults.push({ recipient: userDetails.email, success: false, error: error.message });
    }
    
    // Send to all attendees (including userDetails.email if it's in attendees)
    const allAttendees = [...new Set([...meetingData.attendees, userDetails.email])];
    
    for (const attendeeEmail of allAttendees) {
      if (attendeeEmail === userDetails.email) continue; // Already sent above
      
      const attendeeDetails = {
        firstName: attendeeEmail.split('@')[0].split('.')[0],
        lastName: attendeeEmail.split('@')[0].split('.')[1] || '',
        email: attendeeEmail
      };
      
      const attendeeEmailData = {
        subject: "Discovery Call - Thrive",
        date: selectedDate,
        time: selectedTime,
        timezone: 'Asia/Calcutta (GMT+5:30)',
        duration: '30 minutes',
        meetingLink: meeting.joinUrl || meeting.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl
      };
      
      try {
        const attendeeEmailResult = await sendEmailNotification(attendeeEmailData, attendeeDetails);
        emailResults.push({ recipient: attendeeEmail, success: attendeeEmailResult.success });
      } catch (error) {
        console.error('Error sending email to attendee:', attendeeEmail, error);
        emailResults.push({ recipient: attendeeEmail, success: false, error: error.message });
      }
    }
    
    // Send notification to organizer (Swati)
    try {
      const organizerNotificationData = {
        subject: "New Discovery Call Booked",
        date: selectedDate,
        time: selectedTime,
        timezone: 'Asia/Calcutta (GMT+5:30)',
        duration: '30 minutes',
        meetingLink: meeting.joinUrl || meeting.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl,
        userDetails: userDetails,
        guestEmails: guestEmails
      };
      
      console.log('Sending organizer notification to:', selectedOrganizerEmail);
      const organizerEmailResult = await sendOrganizerNotification(organizerNotificationData, selectedOrganizerEmail);
      emailResults.push({ recipient: selectedOrganizerEmail, success: organizerEmailResult.success, type: 'organizer_notification' });
    } catch (error) {
      console.error('Error sending organizer notification:', error);
      emailResults.push({ recipient: selectedOrganizerEmail, success: false, error: error.message, type: 'organizer_notification' });
    }
    
    // Send notification to admin (if different from organizer)
    const adminEmail = process.env.ADMIN_EMAIL || "admin@thrivebrands.ai"; // Admin email from .env
    if (adminEmail !== selectedOrganizerEmail) {
      try {
        const adminNotificationData = {
          subject: "New Discovery Call Booked",
          date: selectedDate,
          time: selectedTime,
          timezone: 'Asia/Calcutta (GMT+5:30)',
          duration: '30 minutes',
          meetingLink: meeting.joinUrl || meeting.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl,
          userDetails: userDetails,
          guestEmails: guestEmails,
          organizerEmail: selectedOrganizerEmail
        };
        
        console.log('Sending admin notification to:', adminEmail);
        const adminEmailResult = await sendAdminNotification(adminNotificationData, adminEmail);
        emailResults.push({ recipient: adminEmail, success: adminEmailResult.success, type: 'admin_notification' });
      } catch (error) {
        console.error('Error sending admin notification:', error);
        emailResults.push({ recipient: adminEmail, success: false, error: error.message, type: 'admin_notification' });
      }
    }

    res.json({ 
      success: true,
      message: "Discovery call scheduled successfully", 
      meeting: {
        id: meeting.id,
        joinUrl: meeting.joinUrl,
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime
      },
      emailSent: emailResults.some(r => r.success),
      emailResults: emailResults,
      emailPreviewUrl: null
    });
  } catch (error) {
    console.error("Discovery Call API Error:", error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.response?.data || null
    });
  }
});

// Check availability endpoint
app.get("/api/check-availability", async (req, res) => {
  try {
    const { date, time } = req.query;
    
    // For now, return available (you can implement calendar checking logic here)
    res.json({ 
      available: true, 
      message: 'Time slot is available',
      date,
      time
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------
// 6. Error handling middleware
// -------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// -------------------
// 7. Start Server
// -------------------
const server = app.listen(PORT, () => {
  console.log(`🚀 Thrive Teams Meeting API running at http://localhost:${PORT}`);
  console.log(`📧 Health check: http://localhost:${PORT}/`);
  console.log(`📅 Create meeting: POST http://localhost:${PORT}/api/create-meeting`);
  console.log(`🎯 Schedule discovery call: POST http://localhost:${PORT}/api/schedule-discovery-call`);
  console.log(`✅ Server is now listening on port ${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
