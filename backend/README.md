# DermaCare AI authentication backend

This Express API provides signup, email-or-phone one-time-code verification,
login, logout, and the current-user endpoint. It stores users in MongoDB and
keeps the signed-in session in an httpOnly cookie.

## Run locally

Use Node.js 20 or newer.

1. From this folder, copy `.env.example` to `.env`.
2. Set `MONGO_URI` to your MongoDB Atlas connection string.
3. Replace `JWT_SECRET` with a long, private random value.
4. Set `CLIENT_URL` to the exact origin serving the frontend. For example,
   `http://localhost:5500` if you use VS Code Live Server.
5. To send email codes, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and
   `SMTP_PASS`. For Gmail, use `smtp.gmail.com` and a Google App Password
   created after enabling 2-Step Verification. Do not use your normal Gmail
   password.
6. To send phone codes, configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   and `TWILIO_PHONE_NUMBER` with an active Twilio account and sender number.
   You can configure email, phone, or both providers.
7. Install packages and start the API:

   ```sh
   npm install
   npm start
   ```

The default API address is `http://localhost:5000`.

## Connect the frontend

The frontend's API base URL is the `dermacare-api-url` meta tag in the root
`index.html`. It defaults to `http://localhost:5000`. When the backend is
deployed, change its value to the backend's HTTPS origin, without `/api/auth`.
The backend's `CLIENT_URL` must then be the exact origin serving the frontend.

GitHub stores this source code, but GitHub Pages serves static frontend files
and does not run this Node.js server. Deploy the backend to a Node.js hosting
service and configure its environment variables before signup and login can
work on a publicly hosted frontend. Never commit `.env` or database credentials.

## Authentication endpoints

- `POST /api/auth/register` creates a pending account and sends a code to
  exactly one email address or phone number.
- `POST /api/auth/verify-otp` verifies the code and signs the user in.
- `POST /api/auth/resend-otp` sends another code after a one-minute wait.
- `POST /api/auth/login` signs in with a verified email or phone and password.
- `POST /api/auth/logout` clears the authentication cookie.
- `GET /api/auth/me` returns the signed-in user; otherwise it returns `401`.

Browser requests must include credentials so the authentication cookie is sent
and received.

Codes expire after 10 minutes and are stored only as keyed hashes. Each code
allows five attempts; another code can be requested after a one-minute wait.
Signup/resend and login/verification also have per-IP request limits. Phone
numbers must use international format, such as `+919876543210`.
On startup, the backend updates the old required-email unique index to sparse
email and phone unique indexes, so existing email accounts are retained while
phone-only accounts can also be created.

## Test the OTP endpoints

Start signup with exactly one contact:

```json
{
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "password": "choose-a-password",
  "skinType": "oily",
  "concerns": ["acne"]
}
```

Or use a phone number instead of `email`:

```json
{
  "name": "Aarav Sharma",
  "phone": "+919876543210",
  "password": "choose-a-password"
}
```

Then submit the received six-digit code to `/api/auth/verify-otp` with the same
email or phone field and a `code` field. The account is not allowed to log in
before this verification succeeds.
