# Thrive Teams Backend Server

A Node.js backend server for Microsoft Teams meeting integration, built with Express.js and Microsoft Graph API.

## 🚀 Features

- Microsoft Teams meeting creation and management
- Email notifications via Nodemailer
- Microsoft Graph API integration
- CORS enabled for frontend integration
- Environment-based configuration
- Mock mode for development/testing

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Microsoft Azure App Registration (for production)
- Microsoft Teams account (for production)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Fill in your environment variables in the `.env` file:
   ```env
   PORT=5000
   TENANT_ID=your_tenant_id
   CLIENT_ID=your_client_id
   CLIENT_SECRET=your_client_secret
   EMAIL_USER=your_email
   EMAIL_PASS=your_email_password
   ```

## 🚀 Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in your environment variables).

## 📡 API Endpoints

### Create Teams Meeting
- **POST** `/api/meetings/create`
- **Body:**
  ```json
  {
    "subject": "Meeting Subject",
    "startTime": "2024-01-15T10:00:00Z",
    "endTime": "2024-01-15T11:00:00Z",
    "attendees": ["user1@example.com", "user2@example.com"],
    "organizerEmail": "organizer@example.com"
  }
  ```

### Send Email Notification
- **POST** `/api/email/send`
- **Body:**
  ```json
  {
    "to": "recipient@example.com",
    "subject": "Email Subject",
    "html": "<p>Email content</p>"
  }
  ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 5000) |
| `TENANT_ID` | Azure AD Tenant ID | Yes (for production) |
| `CLIENT_ID` | Azure App Client ID | Yes (for production) |
| `CLIENT_SECRET` | Azure App Client Secret | Yes (for production) |
| `EMAIL_USER` | Email username | Yes (for email features) |
| `EMAIL_PASS` | Email password | Yes (for email features) |

### Mock Mode

If Azure credentials are not configured, the server will run in mock mode, providing simulated responses for development and testing purposes.

## 🚀 Deployment

### Vercel Deployment

This project is configured for Vercel deployment. The following files are included:

- `vercel.json` - Vercel configuration
- Environment variables should be set in Vercel dashboard

### Manual Deployment

1. Set up your environment variables on your hosting platform
2. Install dependencies: `npm install --production`
3. Start the server: `npm start`

## 📝 Development

### Project Structure
```
server/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variables template
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

### Adding New Features

1. Create your new route in `server.js`
2. Add any new dependencies to `package.json`
3. Update this README with new endpoints
4. Test thoroughly before deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions, please contact the Thrive Team or create an issue in the repository.

