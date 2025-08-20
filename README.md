# Vezoh - Ride Sharing & Delivery Platform Backend

## 🚀 Project Overview

Vezoh is a comprehensive ride-sharing and delivery platform backend system built with Node.js, Express.js, and MongoDB. The platform supports multiple services including rides, courier delivery, and freight transport with real-time tracking, payment processing, and comprehensive user/driver management.

## 🏗️ System Architecture


┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │   Admin Panel   │    │  Third Party    │
│  (Flutter UI)   │    │   (Web UI)      │    │   Services      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     API Gateway           │
                    │   (Express.js Server)     │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────┴─────────┐   ┌─────────┴─────────┐   ┌─────────┴─────────┐
│   Authentication  │   │   Business Logic  │   │   Real-time       │
│   & Authorization │   │   & Data Layer    │   │   Communication   │
│                   │   │                   │   │   (Socket.IO)     │
└─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     MongoDB Database      │
                    │   (Users, Drivers,        │
                    │   Bookings, Payments)     │
                    └───────────────────────────┘


## 🛠️ Technology Stack

### Backend Technologies
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18+
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time Communication**: Socket.IO
- **Password Hashing**: bcryptjs
- **Validation**: express-validator
- **File Upload**: Multer
- **Security**: Helmet, CORS, Rate Limiting

### Third-Party Integrations
- **SMS Service**: Twilio (OTP verification)
- **Email Service**: Nodemailer (SMTP)
- **Payment Gateway**: Mock implementation (ready for Razorpay/Stripe)
- **Maps & Location**: Google Maps API (for distance calculation)
- **Cloud Storage**: Ready for AWS S3/Cloudinary integration

## 📊 Database Schema

### Collections Overview

vezohDB/
├── users/           # User accounts and profiles
├── drivers/         # Driver accounts and verification
├── bookings/        # Ride/delivery bookings
├── payments/        # Payment transactions
├── tracking/        # Real-time location tracking
└── otps/           # OTP verification records


### Key Models
- **User**: Profile, addresses, payment methods, preferences
- **Driver**: Profile, documents, vehicle info, earnings, availability
- **Booking**: Service requests, status tracking, fare calculation
- **Payment**: Transaction processing, refunds, driver payouts
- **Tracking**: Real-time location updates, route history

## 🔄 User Flow

### Step 1: User Registration

User opens app → Registration screen → Enters details:
- Name: "John Doe"
- Email: "john@example.com"  
- Phone: "+919876543210"
- Password: "password123"
→ OTP verification → Account created


### Step 2: Service Selection

User logs in → Dashboard → Sees 3 service options:
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    RIDE     │  │  COURIER    │  │   FREIGHT   │
│   🚗 Car    │  │  📦 Package │  │  🚛 Truck   │
│   🏍️ Bike   │  │  🍕 Food    │  │  📦 Goods   │
└─────────────┘  └─────────────┘  └─────────────┘


### Step 3: Booking Process

Select service → Enter locations:
From: "MG Road, Bangalore" 
To: "Koramangala, Bangalore"
→ View fare estimate → Choose payment method → Confirm booking


### Step 4: Driver Matching

System finds nearby drivers → Sends booking requests → Driver accepts
→ User sees driver details:
- Name: "Rajesh Kumar"
- Vehicle: "White Swift (KA01AB1234)"
- Rating: ⭐⭐⭐⭐⭐ 4.8
- ETA: "5 minutes"


### Step 5: Real-time Tracking

Driver en route → Live location updates → Pickup notification
→ Trip in progress → Live tracking → Destination reached
→ Payment processing → Trip completion → Rating & feedback


## 🚗 Driver Flow

### Step 1: Driver Registration

Driver opens app → Registration → Enters details:
- Name: "Rajesh Kumar"
- Email: "rajesh@example.com"
- Phone: "+919876543211" 
- License: "DL1420110012345"
- Vehicle Type: "car"
→ OTP verification → Account created (Pending verification)


### Step 2: Document Verification

Upload documents:
├── Driving License → Photo + Details + Expiry
├── Vehicle Registration → RC + Details + Expiry  
├── Insurance → Policy + Expiry
├── Profile Photo → Clear headshot
└── Vehicle Photos → Multiple angles
→ Admin review → Verification status update


### Step 3: Vehicle & Bank Setup

Vehicle Information:
- Make: "Maruti", Model: "Swift", Year: 2020
- Color: "White", Plate: "KA01AB1234"

Bank Details:
- Account: "1234567890"
- IFSC: "SBIN0001234" 
- Name: "Rajesh Kumar"
→ Details verified → Ready to drive


### Step 4: Going Online

Driver dashboard → Toggle status to "Online"
→ Location sharing enabled → Available for bookings
→ Earnings display: Today: ₹1250, This week: ₹8450


### Step 5: Booking Management

Incoming request notification:
┌─────────────────────────────┐
│ New Ride Request            │
│ From: MG Road               │
│ To: Koramangala            │
│ Distance: 8.5 km           │
│ Fare: ₹180                 │
│ [Accept] [Decline]         │
└─────────────────────────────┘
→ Accept → Navigate to pickup → Complete trip → Earnings updated


## 📱 API Documentation

### Authentication APIs

#### User Registration
bash
curl -X POST http://localhost:5000/api/auth/register/user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "password": "password123"
  }'


#### Driver Registration
bash
curl -X POST http://localhost:5000/api/auth/register/driver \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rajesh Kumar",
    "email": "rajesh@example.com",
    "phone": "+919876543211",
    "password": "password123",
    "licenseNumber": "DL1420110012345",
    "vehicleType": "car"
  }'


#### Login
bash
# User Login
curl -X POST http://localhost:5000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Driver Login  
curl -X POST http://localhost:5000/api/auth/login/driver \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rajesh@example.com",
    "password": "password123"
  }'


#### OTP Verification
bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "123456"
  }'


### Booking APIs

#### Create Ride Booking
bash
curl -X POST http://localhost:5000/api/bookings/create \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "ride",
    "vehicleType": "car",
    "pickup": {
      "address": "MG Road, Bangalore",
      "coordinates": {"latitude": 12.9716, "longitude": 77.5946}
    },
    "destination": {
      "address": "Koramangala, Bangalore",
      "coordinates": {"latitude": 12.9279, "longitude": 77.6271}
    },
    "paymentMethod": "cash"
  }'


#### Create Delivery Booking
bash
curl -X POST http://localhost:5000/api/bookings/create \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "delivery",
    "vehicleType": "bike",
    "pickup": {
      "address": "Restaurant ABC, Brigade Road",
      "coordinates": {"latitude": 12.9716, "longitude": 77.5946}
    },
    "destination": {
      "address": "Home Address, Koramangala", 
      "coordinates": {"latitude": 12.9279, "longitude": 77.6271}
    },
    "packageDetails": {
      "weight": "2kg",
      "dimensions": "30x20x15cm",
      "description": "Food delivery"
    },
    "paymentMethod": "upi"
  }'


#### Driver Accept Booking
bash
curl -X POST http://localhost:5000/api/bookings/BOOKING_ID/accept \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "estimatedArrival": 10
  }'


### Real-time Tracking APIs

#### Update Driver Location
bash
curl -X PUT http://localhost:5000/api/tracking/update-location \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID",
    "location": {
      "latitude": 12.9716,
      "longitude": 77.5946,
      "speed": 25,
      "heading": 180
    }
  }'


#### Get Live Location
bash
curl -X GET http://localhost:5000/api/tracking/BOOKING_ID/live-location \
  -H "Authorization: Bearer YOUR_USER_TOKEN"


### Payment APIs

#### Process Payment
bash
curl -X POST http://localhost:5000/api/payments/process \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID",
    "paymentMethod": "upi"
  }'


#### Driver Withdrawal
bash
curl -X POST http://localhost:5000/api/payments/withdraw \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "bankDetails": {
      "accountNumber": "1234567890",
      "ifscCode": "SBIN0001234"
    }
  }'


## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account or local MongoDB
- Twilio account (for SMS)
- SMTP email service

### Installation
bash
# Clone repository
git clone <repository-url>
cd vezoh-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your credentials
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/vezohDB
JWT_SECRET=your_jwt_secret_key
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Start development server
npm run dev


### Production Deployment
bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js --env production

# Setup auto-restart on boot
pm2 startup
pm2 save


## 🔐 Third-Party Integration Setup

### Twilio SMS Setup
1. Sign up at [Twilio.com](https://www.twilio.com/)
2. Get Account SID, Auth Token, and Phone Number
3. Update `.env` file with credentials
4. Test SMS functionality

### Email Service Setup
1. Configure SMTP settings in `.env`
2. For Gmail: Enable 2FA and create App Password
3. Update email credentials
4. Test email functionality

### Payment Gateway Integration
javascript
// Ready for integration with:
// - Razorpay (Indian market)
// - Stripe (Global)
// - PayPal
// - UPI payments


## 📊 API Statistics

**Total Endpoints**: 58 APIs across 6 modules
- **Authentication**: 11 endpoints
- **User Management**: 17 endpoints  
- **Driver Management**: 20 endpoints
- **Booking System**: 8 endpoints
- **Real-time Tracking**: 8 endpoints
- **Payment System**: 7 endpoints

## 🚀 Features Implemented

### Core Features
- ✅ Multi-service platform (Ride, Courier, Freight)
- ✅ Real-time driver tracking
- ✅ Automated driver matching
- ✅ Fare calculation engine
- ✅ Payment processing
- ✅ Rating & review system
- ✅ Driver earnings management
- ✅ Document verification workflow

### Advanced Features
- ✅ Geofencing for pickup/dropoff
- ✅ Route optimization
- ✅ Multi-stop support
- ✅ Scheduled bookings
- ✅ Driver availability management
- ✅ Real-time notifications
- ✅ Analytics and reporting
- ✅ Admin dashboard ready

## 🔄 Real-time Features

### Socket.IO Events
javascript
// User events
'booking-created'     // New booking notification
'driver-assigned'     // Driver matched
'driver-location'     // Live location updates
'trip-started'        // Trip began
'trip-completed'      // Trip finished

// Driver events  
'booking-request'     // New booking available
'booking-cancelled'   // User cancelled
'payment-received'    // Payment processed


## 📱 Mobile App Integration

### Flutter Integration Points
dart
// API Base URL
const String baseUrl = 'http://your-server.com/api';

// Socket connection
Socket socket = io('http://your-server.com', {
  'transports': ['websocket'],
  'autoConnect': false,
});

// Authentication headers
Map<String, String> headers = {
  'Authorization': 'Bearer $token',
  'Content-Type': 'application/json',
};


## 🛡️ Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on APIs
- CORS protection
- Helmet security headers
- Input validation & sanitization
- SQL injection prevention
- XSS protection

## 📈 Scalability Considerations

- Horizontal scaling ready
- Database indexing implemented
- Caching strategy prepared
- Load balancer compatible
- Microservices architecture ready
- CDN integration points
- Auto-scaling configurations

## 🐛 Troubleshooting

### Common Issues
1. **JWT Malformed**: Check Authorization header format
2. **SMS Not Received**: Verify Twilio credentials
3. **Database Connection**: Check MongoDB URI
4. **CORS Errors**: Update allowed origins

### Debug Mode
bash
DEBUG=* npm run dev


## 📞 Support

For technical support or questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review API documentation
- Test with provided cURL commands

---

**Built with ❤️ for the Vezoh Platform**
