# Open the app online with Render

Deployment is prepared in `render.yaml`. It has not been deployed yet. A hosting account must be connected and the application files must be pushed to GitHub first. Creating a Render account alone does not give this chat access to it.

1. Sign in to [Render](https://dashboard.render.com/) with GitHub.
2. Choose **New → Blueprint**, connect the repository containing this application, and select its branch.
3. Set **OWNER_EMAIL** to your login email and **OWNER_PASSWORD** to a new password of at least 12 characters. Enter them in Render, not in chat.
4. Review the proposed web service/database plans and their current limits, then choose **Deploy Blueprint**. This blueprint requests free plans; do not accept a paid plan unless you want it.
5. When the web service says **Live**, open its `https://…onrender.com` address and sign in using the credentials you chose.

On first startup the service applies the checked-in migrations and creates the owner only if the database has no accounts. Restarts never reset credentials or add another owner. The host-provided public URL configures the app's origin check automatically. After successful first login, remove OWNER_PASSWORD from the Render service's environment settings. Existing accounts remain usable without it. Custom domains require setting APP_URL to the exact new HTTPS origin.

The blueprint's database accepts private Render connections only. A hosted database is required; the workspace's local Docker database is not accessible to the deployed service. Workspace data is not automatically transferred. If you later have real lead data, migrate it separately with a verified backup and restore plan.

Free web services can sleep. Free database availability, expiration, storage and backup limits depend on Render's current offering; review these before storing important contacts. Use an appropriate paid database and off-host backups for ongoing business use. If free resources are unavailable, deployment must wait for your plan choice rather than silently creating paid resources.

This deploys lead management and the research/review workflow. Phone-only lookup needs a separately configured Brave Search API key; see RESEARCH.md. Gmail sending and AI pitch generation remain unavailable. A successful deployment must be verified with the live health endpoint, login, import and logout before a public link is reported as working.
