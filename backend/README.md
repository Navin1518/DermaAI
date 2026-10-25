# DermaCare AI authentication backend

This Express API provides signup, login, logout, and the current-user endpoint.
It stores users in MongoDB and keeps the signed-in session in an httpOnly cookie.

## Run locally

1. From this folder, copy `.env.example` to `.env`.
2. Set `MONGO_URI` to your MongoDB Atlas connection string.
3. Replace `JWT_SECRET` with a long, private random value.
4. Set `CLIENT_URL` to the exact origin serving the frontend. For example,
   `http://localhost:5500` if you use VS Code Live Server.
5. Install packages and start the API:

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

- `POST /api/auth/register` creates an account and signs it in.
- `POST /api/auth/login` signs in with email and password.
- `POST /api/auth/logout` clears the authentication cookie.
- `GET /api/auth/me` returns the signed-in user; otherwise it returns `401`.

Browser requests must include credentials so the authentication cookie is sent
and received.
