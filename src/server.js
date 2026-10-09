require('dotenv').config();

const app = require('./app');
const { connectDatabase } = require('./config/database');
const { Article, rethemeDemoArticlesIfNeeded } = require('./models/articleModel');
const { seedDemoUsersIfEmpty } = require('./models/userModel');
const { seedArticlesIfEmpty } = require('./models/articleModel');
const { seedViewsIfEmpty } = require('./models/articleViewModel');
const { seedCommentsIfEmpty } = require('./models/commentModel');

const PORT = process.env.PORT || 3000;
const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'];

function assertRequiredEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  }
}

/**
 * Populates demo data for local development and grading, per the spec's requirement to have
 * 500+ articles, a spread of statuses/categories, reporters, an editor, comments, and view
 * history before the defense. Each seed function is itself a no-op once data already exists,
 * so this is safe to run on every startup. Set SEED_DEMO_DATA=false to skip it entirely
 * (for example against a shared/staging database that should stay empty).
 */
async function seedDemoData() {
  const users = await seedDemoUsersIfEmpty();
  const reporters = users.filter((user) => user.role === 'reporter');
  await seedArticlesIfEmpty(reporters, { total: 500 });
  const rethemedCount = await rethemeDemoArticlesIfNeeded();
  if (rethemedCount) console.log(`Updated ${rethemedCount} generated demo articles with comic-book stories.`);

  // Re-queried rather than trusting seedArticlesIfEmpty's return value, which is undefined
  // once articles already exist — this keeps view/comment seeding correct even if the
  // database was left in a partial state (articles present, views or comments missing).
  const publishedArticles = await Article.find({ published: { $ne: null } }).select('published publishHistory views').lean();
  await seedViewsIfEmpty(publishedArticles);
  await seedCommentsIfEmpty(publishedArticles);
}

async function start() {
  assertRequiredEnvVars();
  await connectDatabase();

  if (process.env.SEED_DEMO_DATA !== 'false') {
    await seedDemoData();
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`The Web Daily is running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start the server:', error.message);
  process.exit(1);
});
