# ECHO BYTES – College Radio Announcement Platform

ECHO BYTES is a modern, production-ready, college-wide announcement system styled like a radio broadcast stream. The system features role-based routing, real-time push notifications, custom audio recording/upload components, and comprehensive administrative analytics.

---

## Project Overview

ECHO BYTES enables college administrators to broadcast general, academic, events, sports, cultural, and urgent announcements. Announcements can contain rich text content, scheduled release dates, and optional audio recordings or file attachments. 

Students can log in to view their feed, play audio attachments, filter broadcasts by category, hide announcements from their personal view, and receive instant popup notification alerts via WebSockets when new announcements go live.

---

## Features

### 🔐 Secure Authentication & Role Detection
- Role assignment is handled implicitly on the backend based on username , user(student)'s username format: yourname@studavvn26

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

## Author

Made by **SHAIK IRFAN**
