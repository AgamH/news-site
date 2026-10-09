# The Daily Bugle - News Management System
This repository contains the final academic project for the Web Applications Development course. It is a fully functional web-based news management and publishing system, designed with modern web architecture principles.

## Academic Project Context
This system was built according to the specific requirements of the course. It demonstrates proficiency in full-stack web development without the use of front-end frameworks (like React or Angular), relying purely on Vanilla JavaScript, HTML5, and CSS3 on the client side, and a robust Node.js/Express environment on the server side.

## Key Features

*   **Public News Feed:** Infinite scrolling news feed with dynamic loading, searching, and filtering (by category, view status, date, and popularity) without page reloads using AJAX.
*   **Article Pages & SEO:** Server-side rendered EJS templates ensure that the full article content is visible in the initial HTML for SEO purposes. Includes an interactive comment section.
*   **Anti-Spam Comments:** Rate-limiting mechanism restricting guests to a maximum of 3 comments per minute per device.
*   **Impact Analytics (Editor):** A chart drawn on an HTML5 `<canvas>` with Vanilla JavaScript (no charting library). It shows an article's views over the last 24 hours, 7 days, or 30 days, marks the exact time of every update an editor approved and published, and lists the views before and after each update in a table below the chart.
*   **Live Weather Integration:** Integration with the free Open-Meteo REST API (no API key or credit card needed) to display local weather in the sidebar. The server caches the result for 5 minutes.
*   **Continuous Workflow (Autosave):** While a reporter writes or edits, the article is saved to the server automatically about 1.5 seconds after they stop typing, with no need to press "Save". Closing the browser, refreshing the page, or moving to another computer never loses work. Autosave changes only the reporter's working copy; the version readers see changes only after an editor approves it.

## User Roles & Permissions

1.  **Guest (Reader):** Can view published articles, search the news feed, and post comments (subject to rate limiting).
2.  **Reporter:** 
    *   Has a personal dashboard.
    *   Can create drafts, edit their own articles, and submit them for editorial review.
    *   Cannot publish articles directly.
3.  **Editor:** 
    *   Has access to the Editor Desk and System Logs.
    *   Reviews pending articles, can approve & publish, return to the reporter with notes, or delete.
    *   Can view analytical view data for each article.

## Technologies & Architecture

*   **Architecture Pattern:** MVC (Model-View-Controller) with strict separation of concerns and RESTful API endpoints.
*   **Backend:** Node.js, Express.js.
*   **Database:** MongoDB via Mongoose ODM (covering Users, Articles, Comments, Analytics, and Logs).
*   **Frontend Views:** EJS (Embedded JavaScript templating).
*   **Styling:** Pure CSS3 (utilizing Flexbox/Grid) with responsive design for Mobile, Tablet, and Desktop.
*   **Client-Side Scripting:** Vanilla JavaScript (ES6+), utilizing the Fetch API for asynchronous background updates.

### Security & Best Practices Highlight
*   **Environment Variables (`.env`):** Sensitive data (API Keys, Database URIs, Session Secrets) are strictly managed via environment variables and never hardcoded or committed to version control.
*   **Asynchronous Controllers:** Heavy reliance on `async/await` patterns wrapped in custom asynchronous handlers within controllers to ensure clean, non-blocking execution and centralized error handling.
*   **Client-Side Sanitization:** `DOMPurify` sanitizes dynamic content received via `GET` requests before it is injected into the DOM, preventing XSS vulnerabilities. It is installed with npm and served by the app at `/vendor/purify.min.js` (no CDN). The shared helper `public/js/sanitize.js` wraps it, and the news feed, weather widget, analytics chart, and system logs all pass their `GET` responses through it.
*   **Secure Authentication:** Passwords are encrypted; roles and permissions are validated securely on the server-side, not just hidden on the UI.

## Project Structure

```text
news-site/
├── src/
│   ├── app.js                 # Express app setup and middleware configuration
│   ├── server.js              # Application entry point and server startup
│   ├── config/                # Database and environment configurations
│   ├── controllers/           # Route logic, async handling, and response formatting
│   ├── middleware/            # Auth, Error handling, and request logging
│   ├── models/                # Mongoose schemas (Users, Articles, Comments, Logs)
│   ├── routes/                # REST API and View routers
│   ├── services/              # Business logic and external API integrations
│   └── utils/                 # Helpers (AsyncHandler, Validators, Error Classes)
├── views/                     # EJS templates (Pages and Partials)
├── public/                    # Static assets
│   ├── css/                   # Stylesheets
│   └── js/                    # Vanilla JS client scripts (AJAX, autosave, canvas chart, DOMPurify helper)
├── test/                      # Unit and integration tests
├── .env.example               # Example of required environment variables
├── package.json               # Dependencies and scripts
└── README.md                  # Project documentation
```

## Installation and Setup

Follow these steps to run the system locally on your machine.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/AgamH/news-site
    cd news-site
    ```

2.  **Install dependencies:**
    Ensure you have Node.js installed, then run:
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Copy `.env.example` to a new file named `.env` in the root directory and fill in the values:
    *   `MONGODB_URI` (required): Your MongoDB connection string (Local or MongoDB Atlas).
    *   `JWT_SECRET` (required): A long random string used to sign login tokens. The server will not start without it.
    *   `PORT`: The port the server will run on (default 3000).
    *   `NODE_ENV`: `development` or `production`.
    *   `SEED_DEMO_DATA`: Set to `false` to skip the automatic demo data (default: seeding is on).
    *   `LOG_TO_FILE`: Set to `true` to also write logs to `logs/application.log` (logs are always saved in MongoDB).
    *   `EDITOR_SIGNUP_CODE`: The code needed to register as an editor at `/register/editor`. Leave blank to disable editor registration.
    *   `WEATHER_CITY`: The city shown in the weather widget (default: New York). No weather API key is needed.

4.  **Demo Data (Automatic):**
    There is no separate seed command. Every time the server starts, it fills any empty collection with demo data: 4 reporters and 1 editor, 500 articles in all statuses and categories (some with several published updates), view history for the analytics chart, and comments.
    *   Demo accounts: `reporter1@example.com` to `reporter4@example.com`, and `editor1@example.com`.
    *   They all share one demo password, defined as `DEMO_PASSWORD` in `src/models/userModel.js`.
    *   To start again with fresh demo data, drop the database and restart the server.

5.  **Run the Test:**
    Start the test:   
    ```bash
    npm test
    ```

6.  **Run the Application:**
    Start the development server:
    ```bash
    npm run dev
    ```
    Or start the production server:
    ```bash
    npm start
    ```

7.  **View the Application:**
    Open your web browser and navigate to `http://localhost:3000` (or whichever port you specified in the `.env` file).

## Main Pages

| Page | Address | Who can open it |
|---|---|---|
| News feed | `/` | Everyone |
| Article page | `/articles/:id` | Everyone |
| Log in / Register | `/login`, `/register/reporter`, `/register/editor` | Everyone |
| Reporter dashboard | `/reporter` | Reporter |
| New / edit article (with autosave) | `/reporter/new`, `/reporter/:id/edit` | Reporter |
| Editor desk | `/editor` | Editor |
| Review an article | `/editor/:id` | Editor |
| Analytics Impact chart | `/editor/:id/analytics` | Editor |
| System logs | `/admin/logs` | Editor |

## REST API

| Method and path | Purpose |
|---|---|
| `GET /api/articles` | Published articles: search, filter, sort, and paging for the news feed |
| `GET /api/articles/:id` | One published article |
| `POST /api/articles/:id/comments` | Add a comment (limited to 3 per minute per device) |
| `GET /api/weather` | Current weather for the sidebar widget |
| `POST /api/auth/register`, `/login`, `/logout` | Accounts and login |
| `POST /api/reporter/articles` | Autosave: first save of a new draft (reporter) |
| `PUT /api/reporter/articles/:id` | Autosave: update a draft's working copy (reporter) |
| `GET /api/editor/articles/:id/analytics?range=24h\|7d\|30d` | View counts and update points for the chart (editor) |
| `GET /api/admin/logs`, `GET /api/admin/logs/:id` | System logs (editor) |