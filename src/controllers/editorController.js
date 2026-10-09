/**
 * Placeholder editor area controller.
 *
 * Deliberately NOT implemented in this branch: the editor queue, review/approve/return flow
 * (Article's approveAndPublish()/returnToReporter()), and the Analytics Impact chart (built
 * on ArticleView, see src/models/articleViewModel.js) are their own unit of work. These stubs
 * exist only so the app boots and /editor doesn't 500 while that work is done.
 *
 * editorRoutes.js already guards every one of these with authenticatePage + requirePageRole
 * ('editor'), so req.user is always a logged-in editor by the time these run.
 */

function comingSoon(res, title) {
  res.status(200).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | The Web Daily</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f5f8;color:#14283f;
       font:400 1rem/1.5 'Segoe UI',system-ui,sans-serif;text-align:center;padding:2rem}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  a{color:#1f4fe0}
</style></head>
<body><div><h1>${title}</h1><p>This part of the editor area is still being built.</p><p><a href="/">Back to stories</a></p></div></body></html>`);
}

function showDashboard(req, res) {
  comingSoon(res, 'Editor queue');
}

function showReview(req, res) {
  comingSoon(res, 'Review article');
}

function showEditForm(req, res) {
  comingSoon(res, 'Edit article');
}

function showAnalytics(req, res) {
  comingSoon(res, 'Analytics Impact');
}

module.exports = { showDashboard, showReview, showEditForm, showAnalytics };
