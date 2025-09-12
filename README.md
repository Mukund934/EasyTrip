# EasyTrip 🌍

> Discover Your Next Adventure - A comprehensive travel destination platform built with Next.js and Node.js

[![Next.js](https://img.shields.io/badge/Next.js-13.0+-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.0+-blue?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.0+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-lightgrey?logo=express)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange?logo=mysql)](https://mysql.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-yellow?logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-blue?logo=tailwindcss)](https://tailwindcss.com/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Architecture](#project-architecture)
- [Installation & Setup](#installation--setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🌟 Overview

EasyTrip is a modern travel destination discovery platform that helps users explore breathtaking destinations with curated recommendations and seamless planning. The platform features an intuitive interface, comprehensive destination management, and powerful admin tools for content management.

### Key Features

- 🏞️ **Curated Destinations** - Handpicked places with detailed information and stunning visuals
- ⭐ **Rating System** - Community-driven reviews and ratings
- 🗺️ **Interactive Maps** - Explore destinations geographically
- 📱 **Responsive Design** - Optimized for all devices
- 🔐 **Secure Authentication** - Firebase-powered user management
- 👥 **Admin Dashboard** - Comprehensive content management system
- 🖼️ **Image Management** - Cloudinary-powered image storage and optimization
- 🔍 **Advanced Search** - Filter by location, category, and preferences

## 🚀 Features

### User Features
- **Destination Discovery**: Browse curated travel destinations with rich media
- **Advanced Filtering**: Search by location, theme, rating, and preferences
- **User Profiles**: Personal accounts with saved favorites and reviews
- **Rating & Reviews**: Community feedback system for destinations
- **Interactive Gallery**: Immersive image galleries with magazine-style layouts
- **Responsive Design**: Seamless experience across desktop and mobile

### Admin Features
- **Content Management**: Add, edit, and manage destination listings
- **Image Upload**: Bulk image upload with automatic optimization
- **User Management**: Monitor user activity and manage accounts
- **Analytics Dashboard**: Track popular destinations and user engagement
- **Review Moderation**: Manage and moderate user reviews

## 🛠️ Technology Stack

### Frontend
- **Next.js 13+** - React framework with App Router
- **React 18** - Modern React with hooks and context
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library for smooth interactions
- **React Icons** - Comprehensive icon library

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MySQL** - Relational database
- **Multer** - File upload middleware
- **CORS** - Cross-origin resource sharing

### Authentication & Storage
- **Firebase Auth** - User authentication and management
- **Cloudinary** - Image storage and optimization
- **JWT** - JSON Web Tokens for secure sessions

### Development Tools
- **ESLint** - Code linting and formatting
- **PostCSS** - CSS processing
- **Git** - Version control

## 🏗️ Project Architecture

```
EasyTrip/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── config/         # Database & service configurations
│   │   ├── controllers/    # Route handlers and business logic
│   │   ├── models/         # Database models and queries
│   │   ├── routes/         # API route definitions
│   │   ├── services/       # Business logic services
│   │   └── utils/          # Middleware and utilities
│   └── tmp/                # Temporary file storage
│
├── frontend/               # Next.js React application
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── pages/         # Next.js pages and API routes
│   │   ├── services/      # API service functions
│   │   ├── context/       # React context providers
│   │   ├── hooks/         # Custom React hooks
│   │   └── utils/         # Helper functions
│   └── styles/            # Global styles and CSS
```

### Architecture Patterns

- **MVC Pattern**: Clear separation of concerns in the backend
- **Component-Based**: Modular React components for reusability
- **Context API**: Global state management for authentication and user data
- **Custom Hooks**: Reusable logic for data fetching and state management
- **API-First**: RESTful API design with clear endpoints

## 🔧 Installation & Setup

### Prerequisites

- Node.js (v18.0 or higher)
- MySQL (v8.0 or higher)
- npm or yarn
- Firebase account
- Cloudinary account

### Environment Variables

Create `.env.local` files in both frontend and backend directories:

#### Backend (.env)
```bash
# Database Configuration
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=easytrip

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Server Configuration
PORT=5000
NODE_ENV=development
```

#### Frontend (.env.local)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

### Database Setup

1. **Create MySQL Database:**
```sql
CREATE DATABASE easytrip;
USE easytrip;
```

2. **Run Database Schema:**
```bash
cd backend
mysql -u your_username -p easytrip < src/config/schema.sql
```

### Backend Setup

1. **Install Dependencies:**
```bash
cd backend
npm install
```

2. **Start Development Server:**
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. **Install Dependencies:**
```bash
cd frontend
npm install
```

2. **Start Development Server:**
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

### Creating Admin User

Run the admin creation script:
```bash
cd backend
node script/make-admin.js
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |
| POST | `/auth/logout` | User logout |
| GET | `/auth/profile` | Get user profile |

### Places Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/places` | Get all places |
| GET | `/places/:id` | Get place by ID |
| POST | `/places` | Create new place (Admin) |
| PUT | `/places/:id` | Update place (Admin) |
| DELETE | `/places/:id` | Delete place (Admin) |
| GET | `/places/:id/image` | Get place image |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/profile` | Get user profile |
| PUT | `/users/profile` | Update user profile |
| GET | `/users/favorites` | Get user favorites |
| POST | `/users/favorites/:id` | Add to favorites |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Admin dashboard data |
| GET | `/admin/users` | Manage users |
| GET | `/admin/places` | Manage places |
| POST | `/admin/places` | Create place |

### Example API Usage

```javascript
// Fetch all places
const response = await fetch('/api/places');
const places = await response.json();

// Create new place (Admin)
const newPlace = {
  name: "Beautiful Destination",
  description: "Amazing place to visit",
  location: "Country, Region",
  tags: ["Nature", "Adventure"]
};

const response = await fetch('/api/places', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newPlace)
});
```

## 🚀 Deployment

### Production Environment Variables

Update your environment variables for production:

```bash
# Backend
NODE_ENV=production
DB_HOST=your_production_db_host
API_URL=https://your-domain.com/api

# Frontend
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

### Database Migration

1. **Backup existing data:**
```bash
mysqldump -u username -p easytrip > backup.sql
```

2. **Run production schema:**
```bash
mysql -u username -p production_db < src/config/schema.sql
```

### Deployment Steps

1. **Build the application:**
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm install --production
```

2. **Deploy to your hosting platform:**
   - **Frontend**: Deploy to Vercel, Netlify, or similar
   - **Backend**: Deploy to Railway, Heroku, or VPS
   - **Database**: Use managed MySQL service (AWS RDS, PlanetScale, etc.)

3. **Configure environment variables** in your hosting platform

4. **Set up domain and SSL certificates**

## 🤝 Contributing

We welcome contributions to EasyTrip! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch:**
```bash
git checkout -b feature/amazing-feature
```

3. **Make your changes and commit:**
```bash
git commit -m "Add amazing feature"
```

4. **Push to your branch:**
```bash
git push origin feature/amazing-feature
```

5. **Create a Pull Request**

### Code Style Guidelines

- Use ES6+ JavaScript features
- Follow React best practices and hooks patterns
- Use Tailwind CSS for styling
- Write meaningful commit messages
- Add comments for complex logic
- Ensure responsive design for all components

### Testing

Before submitting a PR:
- Test on both desktop and mobile devices
- Verify all API endpoints work correctly
- Check for console errors
- Test user authentication flows

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

**Project Maintainer:** Dharmendra
- GitHub: [@dharmendra23101](https://github.com/dharmendra23101)
- Project Link: [https://github.com/dharmendra23101/EasyTrip](https://github.com/dharmendra23101/EasyTrip)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Firebase](https://firebase.google.com/) for authentication services
- [Cloudinary](https://cloudinary.com/) for image management
- [Framer Motion](https://www.framer.com/motion/) for smooth animations
- The open-source community for inspiration and resources

## 🗺️ Roadmap

### Upcoming Features
- [ ] Mobile app (React Native)
- [ ] Trip planning and itinerary builder
- [ ] Social features and user connections
- [ ] Advanced recommendation engine
- [ ] Multi-language support
- [ ] Offline mode support
- [ ] Integration with booking platforms
- [ ] Weather information integration
- [ ] Travel blog and stories feature
- [ ] Augmented reality features

---

**Happy Traveling! 🌍✈️**

> Built with ❤️ for travelers by travelers
