# Driver Flow — API Guide

Base URL
- Local: http://localhost:PORT
- All driver routes are mounted at /driver
- Auth is Bearer JWT unless specified

Conventions
- Header: Authorization: Bearer <token>
- Content-Type: application/json (unless uploading files)
- Validation errors return 400 with an errors array

1) Authentication

1.1 Register
- Purpose: Create a driver account and start OTP verification
- POST /driver/register
- Body: { "name": "kranti Kumar", "email": "kranti@example.com", "phone": "9876543210", "password": "StrongP@ss123" }
- Notes for FE: Call immediately after driver signs up; handle OTP screen next.
- curl:
  curl -X POST "$BASE_URL/driver/register" \
    -H "Content-Type: application/json" \
    -d '{"name":"kranti Kumar","email":"kranti@example.com","phone":"9876543210","password":"StrongP@ss123"}'

1.2 Verify Email OTP
- Purpose: Verify the email OTP to activate account and allow KYC upload
- POST /driver/verify-email-otp
- Body: { "email": "kranti@example.com", "otp": "123456" }
- curl:
  curl -X POST "$BASE_URL/driver/verify-email-otp" \
    -H "Content-Type: application/json" \
    -d '{"email":"kranti@example.com","otp":"123456"}'

1.3 Resend Email OTP
- POST /driver/resend-email-otp
- Body: { "email": "kranti@example.com" }
- curl:
  curl -X POST "$BASE_URL/driver/resend-email-otp" \
    -H "Content-Type: application/json" \
    -d '{"email":"kranti@example.com"}'

1.4 Login
- Purpose: Obtain JWT token for authenticated actions
- POST /driver/login
- Body: { "email": "kranti@example.com", "password": "StrongP@ss123" }
- Response: { token, driver }
- FE: Store token securely; attach as Authorization header.
- curl:
  curl -X POST "$BASE_URL/driver/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"kranti@example.com","password":"StrongP@ss123"}'

1.5 Profile + Logout
- GET /driver/profile
- POST /driver/logout
- curl:
  curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/profile"
  curl -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/logout"

2) Services Selection (Ride/Courier/Goods)

2.1 Choose or Update Services
- Purpose: Persist services the driver offers (multi-select)
- POST /driver/services/add-services
- Body: { "services": ["ride","courier"] }
- Validation: services required, allowed set enforced
- curl:
  curl -X POST "$BASE_URL/driver/services/add-services" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"services":["ride","courier"]}'

2.2 Get Selected Services
- GET /driver/selected-services
- curl:
  curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/selected-services"

2.3 List Services, Get Particular Service
- GET /driver/services
- GET /driver/services/:service
- curl:
  curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/services"
  curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/services/ride"

3) Vehicle Registration & Documents

3.1 Submit Vehicle + Documents
- Purpose: Upload DL, RC, Insurance after OTP verification
- POST /driver/register-vehicle (multipart/form-data)
- Fields (text): driverId, vehicleType, vehicleNumber, ownerName
- Files: drivingLicense, rcCertificate, vehicleInsurance (all required)
- Response: success and driver verification progresses to “under_review”
- FE: Use multipart form, ensure file field names match exactly.
- curl (example file paths):
  curl -X POST "$BASE_URL/driver/register-vehicle" \
    -H "Authorization: Bearer $TOKEN" \
    -F "driverId=DRIVER_OBJECT_ID" \
    -F "vehicleType=auto rickshaw" \
    -F "vehicleNumber=JH098212" \
    -F "ownerName=kranti Kumar" \
    -F "drivingLicense=@./dl_front.jpg" \
    -F "rcCertificate=@./rc_cert.jpg" \
    -F "vehicleInsurance=@./insurance.jpg"

4) Dashboard & Availability

4.1 Dashboard Snapshot
- GET /driver/dashboard
- Purpose: Earnings today, trips count, vehicle status, active services, etc.
- curl:
  curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/dashboard"

4.2 Go Online / Offline
- PUT /driver/status-update
- Body: { "online": true }
- FE: Toggle switch; after going online, poll “incoming” or subscribe to sockets.
- curl:
  curl -X PUT "$BASE_URL/driver/status-update" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"online":true}'

4.3 Incoming Requests (listing)
- GET /driver/incoming/:driverId
- Purpose: List rides near driver that can be accepted
- curl:
  curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/incoming/DRIVER_OBJECT_ID"

5) Trip Lifecycle (Accept → Pickup OTP → In Progress → Complete)

Socket Rooms and Events
- Join room: ride:join with { rideId }
- Driver sends: driver:location { rideId, lat, lng } (server relays ride:location)
- Server emits: ride:location { lat, lng, remainingMeters, remainingSeconds, progressPercent }

REST Fallback for Location
- POST /driver/rides/:rideId/location
- Body: { "lat": 12.934, "lng": 77.615 }
- Response: includes remainingMeters/remainingSeconds and progressPercent.
- curl:
  curl -X POST "$BASE_URL/driver/rides/RIDE_ID/location" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"lat":12.934,"lng":77.615}'

5.1 Accept / Decline
- POST /driver/rides/:rideId/accept
- POST /driver/rides/:rideId/decline
- Guards: Only the assigned/eligible driver can accept; status transition validated.
- curl:
  curl -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/rides/RIDE_ID/accept"
  curl -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/rides/RIDE_ID/decline"

5.2 Verify Pickup (OTP)
- POST /driver/rides/:rideId/verify-pickup-otp
- Body: { "otp": "123456" }
- Transition: verifies pickup and moves status toward in_progress
- curl:
  curl -X POST "$BASE_URL/driver/rides/RIDE_ID/verify-pickup-otp" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"otp":"123456"}'

5.3 Progress Update (discrete status)
- PUT /driver/rides/:rideId/progress
- Body: { "status": "arriving" | "arrived" | "pickup" | "in_progress" }
- curl:
  curl -X PUT "$BASE_URL/driver/rides/RIDE_ID/progress" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"status":"in_progress"}'

5.4 Complete Trip
- POST /driver/rides/:rideId/complete
- Body example: { "paymentMethod":"cash" } (supports "cash","card","upi" per validators)
- Response: trip summary with fare, commission, earnings
- curl:
  curl -X POST "$BASE_URL/driver/rides/RIDE_ID/complete" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"paymentMethod":"cash"}'

6) Earnings

6.1 Earnings Summary
- GET /driver/earnings/summary?limit=10
- Returns: today’s earnings, recent earnings list, weekly totals, availableToWithdraw
- curl:
  curl -H "Authorization: Bearer $TOKEN" "$BASE_URL/driver/earnings/summary?limit=10"

6.2 Withdraw
- POST /driver/earnings/withdraw
- Body: { "amount": 500 }
- Guard: amount > 0 and <= availableToWithdraw
- curl:
  curl -X POST "$BASE_URL/driver/earnings/withdraw" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"amount":500}'

Integration Tips for Frontend Developers

- Auth flow
  - After register, immediately navigate to OTP screen and call verify-email-otp
  - On success, go to services selection → vehicle registration

- Services + Documents
  - Services are a multi-select array under the key "services"
  - Vehicle registration requires exact multipart field names:
    - drivingLicense, rcCertificate, vehicleInsurance

- Real-time trip
  - On “Trip in progress” screen, connect Socket.IO
  - Emit: ride:join with { rideId }
  - Listen: ride:location for coordinates, remaining time, and progressPercent
  - For fallback (offline / sockets blocked): POST /driver/rides/:rideId/location every 2–5s

- Status transitions
  - Typical order: requested → accepted → arriving → arrived → pickup (OTP) → in_progress → completed
  - Guard UI controls so drivers can’t jump states

- Rate limiting
  - Throttle driver:location emits to ~1–2/s to protect quota
  - REST fallback should post every 3–5s max when sockets are unavailable

Environment & Headers

- Authorization: Bearer <token> required on all /driver endpoints except register/login/otp
- File uploads require multipart/form-data
- Maps features need GOOGLE_MAPS_API_KEY on the server

Quick setup
- export BASE_URL="http://localhost:3000"
- export TOKEN="<driver_jwt_token>"

==============================================================================================================================

Assumptions
- Base URL: https://api.example.com (replace as needed)
- Auth: Bearer <TOKEN> in Authorization header
- Placeholders: <TOKEN>, <DRIVER_ID>, <RIDE_ID>, <LAT>, <LNG>, <AMOUNT>, <OTP>
- Content-Type: application/json unless uploading files

1) Service Selection (Choose Services)
Positive
- Add Ride + Courier services
  - Expect 200, services persisted, idempotent on repeats
  - curl:
    curl -X POST https://api.example.com/driver/services/add-services \
      -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
      -d '{"services":["ride","courier"]}'
Negative
- Invalid service value
  - Expect 422 with validation error
- Empty services array
  - Expect 422 with message "at least one service required"
- Unauthenticated
  - Expect 401

2) Vehicle Registration + Documents
Positive
- Submit vehicle details
  - Expect 200 and status pending_verification
  - curl:
    curl -X POST https://api.example.com/driver/vehicle/register \
      -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
      -d '{"vehicleType":"auto_rickshaw","vehicleNumber":"JH09B212","ownerName":"kranti Kumar"}'
- Upload DL/RC/Insurance files
  - Expect 200 with file metadata URLs
  - Example (form-data):
    curl -X POST https://api.example.com/driver/documents/upload \
      -H "Authorization: Bearer <TOKEN>" \
      -F "type=dl" -F "file=@/path/dl.jpg"
Negative
- Invalid vehicleType
  - Expect 422
- Missing required fields
  - Expect 422
- Invalid/oversized file upload
  - Expect 422 or 413

3) Verification Status
Positive
- Fetch verification state
  - Expect 200 with selected services marked pending/approved
  - curl:
    curl -H "Authorization: Bearer <TOKEN>" https://api.example.com/driver/verification/status
Negative
- Unauth
  - 401

4) Go Online/Offline + Location
Positive
- Go online with location
  - Expect 200, availability: true
  - curl:
    curl -X POST https://api.example.com/driver/status/online \
      -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
      -d '{"lat":<LAT>,"lng":<LNG>}'
- Go offline
  - curl:
    curl -X POST https://api.example.com/driver/status/offline \
      -H "Authorization: Bearer <TOKEN>"
Negative
- Online without lat/lng
  - 422
- Online while verification pending
  - 409 with message e.g., "documents not verified"
- Unauth
  - 401

5) Incoming Requests (Driver Dashboard)
Positive
- List incoming requests while online
  - Expect 200 list of rides with ETA/fare
  - curl:
    curl -H "Authorization: Bearer <TOKEN>" https://api.example.com/driver/requests
Negative
- While offline
  - 200 empty list
- Location too far from pickup radius
  - 200 empty list

6) Accept / Decline Ride
Positive
- Accept a requested ride
  - Expect 200, ride.status: accepted, driverId assigned, socket event broadcast
  - curl:
    curl -X POST https://api.example.com/driver/rides/<RIDE_ID>/accept \
      -H "Authorization: Bearer <TOKEN>"
- Decline requested ride
  - Expect 200, ride remains available to others (or recorded as declined)
  - curl:
    curl -X POST https://api.example.com/driver/rides/<RIDE_ID>/decline \
      -H "Authorization: Bearer <TOKEN>"
Negative
- Accept after another driver already accepted
  - 409 "ride already accepted"
- Accept ride not in requested state
  - 409 "invalid state"
- Unauth
  - 401

7) Verify Pickup via OTP
Positive
- Correct OTP
  - Expect 200, ride.status: in_progress, timeline.pickupAt set
  - curl:
    curl -X POST https://api.example.com/driver/rides/<RIDE_ID>/verify-pickup \
      -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
      -d '{"otp":"<OTP>"}'
Negative
- Wrong OTP
  - 400/401 "invalid OTP"
- Call before accept
  - 409 "ride not accepted"
- Unauth
  - 401

8) Trip in Progress – Live Location (Socket + REST)
Socket.IO Positive
- Join the ride room, emit driver location, observe ride:location payload on client
  - client pseudo:
    socket.emit("ride:join",{rideId:"<RIDE_ID>"})
    socket.emit("driver:location",{rideId:"<RIDE_ID>",lat:<LAT>,lng:<LNG>})
  - Expect room to receive ride:location {lat,lng,remaining:{meters,seconds},progressPercent}
REST Fallback Positive
- Update location via API
  - curl:
    curl -X POST https://api.example.com/driver/rides/<RIDE_ID>/location \
      -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
      -d '{"lat":<LAT>,"lng":<LNG>}'
  - Expect 200; body contains remaining meters/seconds and progressPercent; socket broadcast occurs
Negative
- Invalid lat/lng types
  - 422
- Too frequent updates (throttle enabled)
  - 429 or 200 with skipped ETA recalculation; verify server logs/response flag
- After ride is completed/canceled
  - 409 "ride not in progress"
- Not joined socket room on client
  - No updates received client-side (fix by emitting ride:join)

9) Complete Trip
Positive
- Complete in_progress ride
  - Expect 200, ride.status: completed, timeline.completedAt set, earnings updated
  - curl:
    curl -X POST https://api.example.com/driver/rides/<RIDE_ID>/complete \
      -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
      -d '{"paymentMethod":"cash"}'
Negative
- Complete before in_progress
  - 409 "invalid state"
- Invalid payment method
  - 422
- Double completion
  - 409

10) Earnings Summary
Positive
- Today + recent earnings
  - curl:
    curl -H "Authorization: Bearer <TOKEN>" "https://api.example.com/driver/earnings/summary?limit=10"
  - Expect 200 with totals and recent items (uses pickup/destination, timeline.completedAt)
Negative
- limit out of range
  - 422

11) Withdraw
Positive
- Withdraw less than or equal to available
  - curl:
    curl -X POST https://api.example.com/driver/earnings/withdraw \
      -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
      -d '{"amount": <AMOUNT> }'
  - Expect 200 with new balance and transaction record
Negative
- amount <= 0
  - 422
- amount > available
  - 409
- Unauth
  - 401

12) Socket Join/Leave (Sanity)
Positive
- Join ride room and receive broadcasts
  - Expect success and subsequent ride:location events
Negative
- Join with invalid rideId
  - Server may ignore/join fails silently; ensure validation logs

Troubleshooting Guide
- 401 Unauthorized
  - Check Authorization header format: "Bearer <TOKEN>"
  - Ensure token unexpired, correct environment keys, server time synced
- 403/409 on online or accept
  - Driver not verified, or ride already accepted; refresh driver status or user’s active ride; refetch and retry
- 422 Validation errors
  - Inspect response errors; ensure required fields and types; lat/lng must be numbers, amount > 0, services non-empty and allowed values
- No live updates on “Trip in progress”
  - Client must join room: socket.emit("ride:join",{rideId})
  - Verify server wired setIO(io) and CORS/socket origins
  - Check event names: driver:location from driver; ride:location received by rider/driver UI
  - If using REST fallback, verify POST /driver/rides/:rideId/location responses and logs
- ETA/distance missing or inconsistent
  - Ensure GOOGLE_MAPS_API_KEY set; verify quota; look for 403/429 from Maps
  - Throttling: ETA recompute is limited (e.g., ~10s); progressPercent still updates from waypoints
- Wrong progress bar
  - Confirm route polyline stored on createRide; reducer caps waypoints (ROUTE_WAYPOINT_CAP); if route missing, confirm backfill logic runs once
  - Verify driver location payload accuracy (coordinate system, precision)
- File uploads failing
  - Use multipart/form-data; correct field names (type=file type=dl/rc/insurance); check size limits
- Race conditions on accept
  - If two drivers accept same ride, expect 409 for latter; frontend should handle by refreshing list/active ride
- Rate limiting
  - If location updates get 429, reduce frequency (1–2/sec) and rely on socket batch updates