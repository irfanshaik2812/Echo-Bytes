# ECHO BYTES – College Radio Announcement Platform

ECHO BYTES is a modern, production-ready, college-wide announcement system styled like a radio broadcast stream. The system features role-based routing, real-time push notifications, custom audio recording/upload components, and comprehensive administrative analytics.

---

## Project Overview

ECHO BYTES enables college administrators to broadcast general, academic, events, sports, cultural, and urgent announcements. Announcements can contain rich text content, scheduled release dates, and optional audio recordings or file attachments. 

Students can log in to view their feed, play audio attachments, filter broadcasts by category, hide announcements from their personal view, and receive instant popup notification alerts via WebSockets when new announcements go live.

---

## Features

### 🔐 Secure Authentication & Role Detection
- Role assignment is handled implicitly on the backend based on username format:
  - **Admins**: Usernames must end with `@mngrhereavvn26`
  - **Students**: Usernames must end with `@studavvn26`
- Form fields dynamically adapt to show Admin-specific fields (Manager ID, Post, Qualification) or Student-specific fields (Roll Number, Class, Section) during registration.
- Route guards and middleware secure backend APIs and static views.

### 📢 Admin Features
- **Announcement Builder**: Create, edit, and delete announcements with a snow-themed rich text editor (Quill).
- **View Tracking**: Detailed tracking of which students have viewed an announcement, listing their username, roll number, class, section, and view timestamp.
- **Search & History**: Live full-text search by title/content, category filters, publish-date filters, and search history tracking with clear/re-run utilities.
- **Analytics Dashboard**: Time-series charts (Chart.js) showing views over time, total views, and unique viewers count. Includes a **CSV Data Export** function.

### 🎓 Student Features
- **Announcement Feed**: Premium responsive feed showing current, active announcements.
- **Category Filters**: Chip-based navigation to filter broadcasts instantly.
- **Personal Controls**: Hide announcements from the feed. Hidden announcements are sent to a private "Hidden Panel" where students can restore them to the main feed at any time.

### 🎙️ Audio Recording & Uploads
- Custom recording interface using the HTML5 MediaRecorder API.
- File upload integration supporting MP3, WAV, WebM, and other standard formats.
- Single-source validation: enforces either Uploaded Audio OR Microphone Recording.
- Preview players with custom scrubbers, play/pause state icons, and complete removal buttons.

### ⏰ Scheduled Announcements
- Fully integrated scheduling flow. Announcements can be set to publish at a future date and time.
- A background Cron job runs every minute to scan the database, release scheduled announcements, and push real-time alerts to active students.

### 🔔 Real-time Notifications
- Instant push notifications sent to active student sessions via WebSockets (Socket.IO).
- Features a notification bell in the header, an unread counter badge, and a recent notifications dropdown list.

---

## Technologies Used

- **Frontend**: HTML5, Vanilla CSS3 (Custom design system with dark/light themes, glassmorphism, and smooth micro-animations), ES6 JavaScript.
- **Rich Text Editor**: Quill.js.
- **Data Visualization**: Chart.js.
- **Backend**: Node.js, Express.js.
- **Database**: SQLite via `better-sqlite3` (single-file server-side storage).
- **Real-Time Communication**: Socket.IO (WebSockets).
- **Automation**: `node-cron` for scheduling.

---

## Project Structure

```text
echo-bytes/
├── backend/
│   ├── controllers/            # Request handlers (auth, announcements, analytics, notifications)
│   │   ├── analyticsController.js
│   │   ├── announcementController.js
│   │   ├── authController.js
│   │   └── notificationController.js
│   ├── middleware/             # Route guards (auth, roleGuard)
│   │   ├── auth.js
│   │   └── roleGuard.js
│   ├── routes/                 # API endpoint routers
│   │   ├── analyticsRoutes.js
│   │   ├── announcementRoutes.js
│   │   ├── authRoutes.js
│   │   └── notificationRoutes.js
│   ├── uploads/                # Directory for uploaded audio (Git-ignored)
│   ├── database.js             # SQLite connection and schema definition
│   ├── echobytes.db            # Local database file (Git-ignored)
│   ├── package.json
│   └── server.js               # Entry point, Express app, Cron, and Socket.IO initialization
├── frontend/
│   ├── assets/                 # App logo and static assets
│   ├── css/                    # Modular layout styles (auth, admin, student, landing, main)
│   │   ├── admin.css
│   │   ├── auth.css
│   │   ├── landing.css
│   │   ├── main.css
│   │   └── student.css
│   ├── js/                     # Modular frontend scripts (API, auth, admin, student, theme)
│   │   ├── admin.js
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── landing.js
│   │   ├── notifications.js
│   │   ├── student.js
│   │   └── theme.js
│   ├── admin.html              # Administrator view
│   ├── index.html              # Authentication screen (Login / Sign Up)
│   ├── landing.html            # Intro screen with animations
│   └── student.html            # Student view
├── .env.example                # Template for environment configuration
├── .gitignore                  # Git exclusions definition
└── README.md                   # Project documentation
```

---

## Installation & Setup

### Prerequisites
- Node.js (version 16 or higher recommended)
- npm (Node Package Manager)

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/echo-bytes.git
   cd echo-bytes
   ```

2. **Install Backend Dependencies**
   Navigate to the `backend` folder and install:
   ```bash
   cd backend
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the `backend` folder (or set the variables globally in your environment) based on `.env.example`:
   ```bash
   PORT=3000
   JWT_SECRET=your_secure_random_key_here
   NODE_ENV=development
   ```

4. **Initialize Database**
   The database schema is automatically checked and initialized in a local SQLite file (`backend/echobytes.db`) upon launching the server.

---

## How to Run

### Development Mode (with hot-reloading)
Run the following inside the `backend` directory:
```bash
npm run dev
```

### Production Mode
Run the following inside the `backend` directory:
```bash
npm start
```

Once running, navigate to **`http://localhost:3000`** in your browser to open the landing page.

---

## Author

Made by **SHAIK IRFAN**
