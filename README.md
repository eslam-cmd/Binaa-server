# Freelance Platform — Backend API

[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![JWT](https://img.shields.io/badge/JWT-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io)

A secure and reliable REST API built with Node.js and Express.js, powering a freelance/consulting platform with OTP-based admin authentication, content management, service listings, request handling, and an administrative dashboard.

---

## 🛠️ Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **PostgreSQL** | Relational database |
| **pg** | PostgreSQL client |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT authentication |
| **nodemailer** | Email / OTP delivery |
| **helmet** | HTTP security headers |
| **cors** | Cross-origin resource sharing |
| **express-rate-limit** | API rate limiting |
| **cookie-parser** | Cookie management |

---

## 📁 Project Structure

```text
server/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── postController.js
│   │   ├── requestController.js
│   │   └── serviceController.js
│   ├── lib/
│   │   ├── crypto.js
│   │   ├── email.js
│   │   └── telegram.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── rateLimit.js
│   │   └── security.js
│   ├── models/
│   │   ├── OTP.js
│   │   ├── Post.js
│   │   ├── Request.js
│   │   ├── Service.js
│   │   ├── Session.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── postRoutes.js
│   │   ├── requestRoutes.js
│   │   └── serviceRoutes.js
│   └── utils/
│       ├── helpers.js
│       └── validators.js
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL instance (local or cloud)

### Installation

```bash
# Clone the repository
git clone https://github.com/eslam-cmd/freelance-server.git
cd server

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file inside the `server/` directory:

```env
PORT=5001
DATABASE_URL=postgresql://...your_db_url...
JWT_SECRET=your_secret_key
COOKIE_SECRET=your_cookie_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
NODE_ENV=development
```

### Run the Server

```bash
# Development
npm run dev

# Production
npm start
```

### Health Check

```bash
curl http://localhost:5001/health
```

Expected response:

```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

## 🔐 Authentication Flow

Authentication uses session-based cookies with OTP verification.

### Step 1 — Login

```http
POST /api/auth/login
```

```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

Response:

```json
{
  "success": true,
  "message": "OTP sent",
  "userId": 1
}
```

### Step 2 — Verify OTP

```http
POST /api/auth/verify
```

```json
{
  "userId": 1,
  "otp": "123456"
}
```

### Step 3 — Check Session

```http
GET /api/auth/session
```

Response:

```json
{
  "isAuthenticated": true,
  "user": {
    "id": 1,
    "email": "admin@example.com"
  }
}
```

### Step 4 — Logout

```http
POST /api/auth/logout
```

---

## 🗺️ API Endpoints

### Authentication

| Method | Route | Description |
| :--- | :--- | :--- |
| POST | `/api/auth/login` | Submit credentials & request OTP |
| POST | `/api/auth/verify` | Verify OTP code |
| GET | `/api/auth/session` | Check current session |
| POST | `/api/auth/logout` | Logout |

### Posts

| Method | Route | Description |
| :--- | :--- | :--- |
| GET | `/api/posts` | Get all posts |
| GET | `/api/posts/:id` | Get single post |
| POST | `/api/posts` | Create post (Admin only) |
| PUT | `/api/posts/:id` | Update post (Admin only) |
| DELETE | `/api/posts/:id` | Delete post (Admin only) |

### Requests

| Method | Route | Description |
| :--- | :--- | :--- |
| GET | `/api/requests` | Get all requests (Admin only) |
| GET | `/api/requests/:id` | Get single request |
| POST | `/api/requests` | Submit new client request |
| PUT | `/api/requests/:id/status` | Update request status |

### Services

| Method | Route | Description |
| :--- | :--- | :--- |
| GET | `/api/services` | Get all services |
| GET | `/api/services/:id` | Get single service |
| POST | `/api/services` | Create service (Admin only) |
| PUT | `/api/services/:id` | Update service (Admin only) |
| DELETE | `/api/services/:id` | Delete service (Admin only) |

### Admin Dashboard

| Method | Route | Description |
| :--- | :--- | :--- |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/activities` | Activity log |
| GET | `/api/visitors` | Visitor list |

---

## 🔒 Security

**CORS**
Configured to allow specific origins only with cookie support:
```js
credentials: true
```

**Rate Limiting**
Applied to:
- Login endpoint
- Request creation
- Public post and service access

**Helmet & Input Sanitization**
- HTTP security headers via Helmet
- Input sanitization on all routes
- Parameter pollution prevention
- Full activity logging

**Frontend Fetch Example**
```js
const res = await fetch("http://localhost:5001/api/services", {
  method: "GET",
  credentials: "include",
});
const data = await res.json();
```

---

## 🗄️ Database

PostgreSQL connected via:

```env
DATABASE_URL
```

Connection pool managed in `src/config/database.js` and used across all controllers.

Every admin action (create, update, delete service or request) is logged to the `activity_logs` table, powering the dashboard notifications, activity feed, and statistics.

---

## ⚠️ Common Errors

**Database disconnected**
```text
database disconnected
```
Check `DATABASE_URL`, credentials, and host address.

**401 / 403 Unauthorized**
The route requires a valid session. Ensure the user is authenticated.

**CORS Error**
Verify `ALLOWED_ORIGINS`, `credentials: true`, and that the frontend runs on the correct localhost port.

---

## 📬 Contact

Built by **Islam Hadaya**

- Portfolio: [my-profile-personal-nextjs.vercel.app](https://my-profile-personal-nextjs.vercel.app)
- LinkedIn: [linkedin.com/in/islam-hadaya](https://linkedin.com/in/islam-hadaya)
- Email: [hdayaaslam34@gmail.com](mailto:hdayaaslam34@gmail.com)

---

*Last Updated: September 2026*
