/**
 * Placeholder reporter workspace controller.
 *
 * Deliberately NOT implemented in this branch: a real reporter dashboard (article list +
 * status, autosave create/edit form, submit-for-approval) is its own unit of work, built on
 * top of Article's submitForApproval()/EDITABLE_STATUSES (see src/models/articleModel.js).
 * These stubs exist only so the app boots and /reporter doesn't 500 while that work is done.
 *
 * reporterRoutes.js already guards every one of these with authenticatePage + requirePageRole
 * ('reporter'), so req.user is always a logged-in reporter by the time these run.
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
<body><div><h1>${title}</h1><p>This part of the reporter workspace is still being built.</p><p><a href="/">Back to stories</a></p></div></body></html>`);
}

function showDashboard(req, res) {
  comingSoon(res, 'My workspace');
}

/** Not wrapped in asyncHandler by the routes (see reporterRoutes.js) — must stay synchronous. */
function showNewForm(req, res) {
  comingSoon(res, 'New article');
}

function showEditForm(req, res) {
  comingSoon(res, 'Edit article');
}

module.exports = { showDashboard, showNewForm, showEditForm };
