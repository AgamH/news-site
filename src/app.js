const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const pageRoutes = require('./routes/pageRoutes');
const authRoutes = require('./routes/authRoutes');
const articleRoutes = require('./routes/articleRoutes');
const reporterRoutes = require('./routes/reporterRoutes');
const editorRoutes = require('./routes/editorRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const adminRoutes = require('./routes/adminRoutes');

const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
// Lets res.render('error', ...) work even if the view that triggered the error hasn't
// rendered anything yet, and keeps stack traces out of rendered pages in production.
app.set('x-powered-by', false);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(requestLogger);

// Page routes (server-rendered EJS) at the root.
app.use('/', pageRoutes);

// JSON APIs, matching the paths views/index.ejs and public/js/home.js already call.
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/admin', adminRoutes);

// Logged-in work areas, matching the redirect targets public/js/auth.js already uses.
app.use('/reporter', reporterRoutes);
app.use('/editor', editorRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.use(express.static(path.join(__dirname, '../public')));

module.exports = app;
