# Deploying your Wasp App to Fly.io

Wasp makes deploying to Fly.io incredibly simple with its built-in CLI. Since you're authenticated, we can let Wasp handle the heavy lifting (provisioning the server, building the Docker image, setting up the PostgreSQL database, and linking them together).

Here is the exact step-by-step process.

### Step 1: Launch the Application
Navigate to your `app` directory and use the `launch` command. Replace `my-roboform-app` with your desired globally-unique app name, and `iad` with your preferred Fly.io region code (e.g., `ams` for Amsterdam, `syd` for Sydney, `iad` for Virginia).

```bash
cd /home/vinu/Desktop/BUSINESS_MONEY/EVOFORM/roboform/app
wasp deploy fly launch my-roboform-app iad
```

> [!NOTE]
> This command will automatically:
> 1. Create a Fly.io app for your Wasp server.
> 2. Create a Fly.io app for your Wasp client (web interface).
> 3. Provision a managed PostgreSQL database and attach it to your server.
> 4. Build and deploy everything.

### Step 2: Configure Production Secrets
Your OpenSaaS app relies on several environment variables (like authentication secrets, Stripe keys, and email credentials). You need to push these from your local [.env.server](file:///home/vinu/Desktop/BUSINESS_MONEY/EVOFORM/roboform/app/.env.server) to Fly.io using Wasp's secret command.

Run the following for **each** required secret:
```bash
wasp deploy fly cmd secrets set JWT_SECRET="your-super-long-random-string"
wasp deploy fly cmd secrets set STRIPE_API_KEY="sk_live_..."
# ... repeat for any other secrets your app needs in production
```

*(Note: Wasp automatically handles setting the `DATABASE_URL`, `WASP_WEB_CLIENT_URL`, and `WASP_SERVER_URL` for you during launch!)*

### Step 3: Verify the Deployment
Once the launch finishes and secrets are set, your client and server will be live. You can check the status and get the live URLs by running:

```bash
wasp deploy fly cmd status
```

Or simply open the live app in your browser:
```bash
wasp deploy fly cmd open
```
