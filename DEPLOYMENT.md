# 🚀 Deployment Guide

This guide will walk you through deploying your Thrive Teams Backend to GitHub and then to Vercel.

## 📋 Prerequisites

- Git installed on your machine
- GitHub account
- Vercel account
- Node.js project ready (which you have)

## 🔄 Step 1: Deploy to GitHub

### 1.1 Initialize Git Repository (if not already done)

```bash
cd server
git init
```

### 1.2 Add Files to Git

```bash
git add .
git commit -m "Initial commit: Thrive Teams Backend Server"
```

### 1.3 Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click "New repository"
3. Name it: `thrive-teams-backend` (or your preferred name)
4. Make it **Public** (Vercel works better with public repos)
5. **Don't** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 1.4 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/thrive-teams-backend.git
git branch -M main
git push -u origin main
```

## ☁️ Step 2: Deploy to Vercel

### 2.1 Connect Vercel to GitHub

1. Go to [Vercel](https://vercel.com)
2. Sign up/Login with your GitHub account
3. Click "New Project"
4. Import your GitHub repository (`thrive-teams-backend`)
5. Vercel will automatically detect it's a Node.js project

### 2.2 Configure Vercel Settings

1. **Framework Preset**: Node.js (should be auto-detected)
2. **Root Directory**: `./` (leave as default)
3. **Build Command**: `npm run build` (or leave empty)
4. **Output Directory**: `./` (leave as default)
5. **Install Command**: `npm install`

### 2.3 Set Environment Variables

Before deploying, add these environment variables in Vercel:

1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add the following variables:

```
TENANT_ID=your_azure_tenant_id
CLIENT_ID=your_azure_client_id
CLIENT_SECRET=your_azure_client_secret
ORGANIZER_EMAIL=admin@thrivebrands.ai
ADMIN_EMAIL=admin@thrivebrands.ai
PORT=5000
```

**Important**: 
- Replace the values with your actual Azure credentials
- Set all variables for **Production**, **Preview**, and **Development** environments
- Keep your secrets secure - never commit them to Git

### 2.4 Deploy

1. Click "Deploy"
2. Vercel will build and deploy your application
3. You'll get a URL like: `https://your-project-name.vercel.app`

## 🔧 Step 3: Verify Deployment

### 3.1 Test Your API

Your API will be available at:
- `https://your-project-name.vercel.app/` (health check)
- `https://your-project-name.vercel.app/api/meetings/create` (create meeting)
- `https://your-project-name.vercel.app/api/email/send` (send email)

### 3.2 Test with Postman or cURL

```bash
# Health check
curl https://your-project-name.vercel.app/

# Create meeting (example)
curl -X POST https://your-project-name.vercel.app/api/meetings/create \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Meeting",
    "startTime": "2024-01-15T10:00:00Z",
    "endTime": "2024-01-15T11:00:00Z",
    "attendees": ["test@example.com"],
    "organizerEmail": "admin@thrivebrands.ai"
  }'
```

## 🔄 Step 4: Update Frontend (if needed)

Update your frontend to use the new Vercel URL:

```javascript
// Replace localhost:5000 with your Vercel URL
const API_BASE_URL = 'https://your-project-name.vercel.app';

// Update your API calls
const response = await fetch(`${API_BASE_URL}/api/meetings/create`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(meetingData)
});
```

## 🔄 Step 5: Continuous Deployment

### 5.1 Automatic Deployments

Vercel will automatically deploy when you push to your main branch:

```bash
# Make changes to your code
git add .
git commit -m "Update API endpoint"
git push origin main
# Vercel will automatically deploy the changes
```

### 5.2 Preview Deployments

When you create a pull request, Vercel will create a preview deployment with a unique URL.

## 🛠️ Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Vercel build logs
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version compatibility

2. **Environment Variables Not Working**
   - Double-check variable names in Vercel dashboard
   - Ensure variables are set for all environments
   - Redeploy after adding new variables

3. **CORS Issues**
   - Update your frontend URL in CORS configuration
   - Add your frontend domain to allowed origins

4. **API Not Responding**
   - Check Vercel function logs
   - Verify your `vercel.json` configuration
   - Test locally first

### Debugging

1. **Check Vercel Logs**
   - Go to your project dashboard
   - Click on "Functions" tab
   - View function logs for errors

2. **Local Testing**
   - Test your API locally first
   - Use the same environment variables locally

## 📞 Support

If you encounter issues:

1. Check Vercel documentation: https://vercel.com/docs
2. Review your build logs in Vercel dashboard
3. Test your API locally to isolate issues
4. Check GitHub repository for any configuration issues

## 🎉 Success!

Once deployed, your API will be:
- ✅ Accessible globally
- ✅ Automatically scaled
- ✅ Continuously deployed
- ✅ Monitored and logged
- ✅ SSL secured

Your Thrive Teams Backend is now live and ready to serve your frontend application!
