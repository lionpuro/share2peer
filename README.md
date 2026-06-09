# Websend

Websend is a web application that allows you to share files between devices through a direct connection, without uploading them to a server.

## Getting Started

0. Install docker and docker compose plugin

1. Clone the repository

2. Configure environment variables

   Each package has its own .env file. Create the `.env` files using `.env.example` as a template
   and fill them with your values:

   ```sh
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Start the development container

   ```sh
   docker compose up -d
   ```

4. Open a shell into the container

   ```sh
   docker compose exec app bash
   ```

5. Install Dependencies

   ```sh
   npm install
   ```

6. Start the development servers

   ```sh
   npm run dev
   ```

By default, the app will be served on `https://localhost:5173`
