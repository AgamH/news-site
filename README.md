# The Daily Bugle - News Management System
This repository contains the final academic project for the Web Applications Development course. It is a fully functional web-based news management and publishing system, designed with modern web architecture principles.

## Academic Project Context
This system was built according to the specific requirements of the course. It demonstrates proficiency in full-stack web development without the use of front-end frameworks (like React or Angular), relying purely on Vanilla JavaScript, HTML5, and CSS3 on the client side, and a robust Node.js/Express environment on the server side.

## Key Features

*   **Public News Feed:** Infinite scrolling news feed with dynamic loading, searching, and filtering (by category, view status, date, and popularity) without page reloads using AJAX.
*   **Article Pages & SEO:** Server-side rendered EJS templates ensure that the full article content is visible in the initial HTML for SEO purposes. Includes an interactive comment section.
*   **Anti-Spam Comments:** Rate-limiting mechanism restricting guests to a maximum of 3 comments per minute per device.
*   **Impact Analytics (Editor):** A dedicated dashboard utilizing Canvas/Chart.js to display article view trends over time, highlighting when specific updates were published.
*   **Live Weather Integration:** Integration with a third-party REST API (OpenWeatherMap) to display local weather in the sidebar.
*   **Continuous Workflow:** Auto-saving functionality for reporters to ensure work is never lost, even if the browser closes or the server restarts.

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
*   **Client-Side Sanitization:** `DOMPurify` is actively used on the client-side to sanitize dynamic content received via `GET` requests before injecting it into the DOM, preventing XSS vulnerabilities.
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
│   └── js/                    # Vanilla JS client scripts (AJAX, DOMPurify)
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
    Create a `.env` file in the root directory based on the `.env.example` file. You will need to provide:
    *   `PORT`: The port the server will run on (e.g., 3000).
    *   `MONGODB_URI`: Your MongoDB connection string (Local or MongoDB Atlas).
    *   `SESSION_SECRET`: A secure random string for session encryption.
    *   `WEATHER_API_KEY`: A valid API key from OpenWeatherMap.

4.  **Seed the Database (Optional but Recommended for Demo):**
    If a seed script is provided in the project, run it to populate the database with mock articles, comments, and users for testing purposes.
    *(Check package.json for specific seed commands like `npm run seed`)*

5.  **Run the Application:**
    Start the development server:
    ```bash
    npm run dev
    ```
    Or start the production server:
    ```bash
    npm start
    ```

6.  **View the Application:**
    Open your web browser and navigate to `http://localhost:3000` (or whichever port you specified in the `.env` file).