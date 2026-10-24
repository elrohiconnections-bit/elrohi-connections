ELROHI CONNECTION WEBSITE
=========================

Main pages
- index.html                  Main website
- partner.html                Become a Partner form
- admin.html                  Admin dashboard for partner submissions
- mentoring-guides.html       Mentoring resources
- family-support.html         Family resources
- leadership-stem.html        Leadership & STEM resources

LOCAL PREVIEW
Open index.html or partner.html in your browser.
Partner submissions made while opening the files directly are saved only in that browser for preview/testing.
Open admin.html and use this LOCAL PREVIEW key:
    preview
You can view the test submissions, export them, and use the Reset tab to clear them.

IMPORTANT: production partner storage
-------------------------------------
The website includes a Cloudflare Pages Function at:
    functions/api/partners.js
and the database schema at:
    schema.sql

For a live website, create a Cloudflare D1 database and bind it to the Pages project with the binding name:
    DB
Run schema.sql against the D1 database.
Then create a Cloudflare Pages secret/environment variable:
    ADMIN_KEY
Set ADMIN_KEY to a strong private password/access key that only the administrator knows.

How it works in production
- Visitors submit partner.html.
- Submissions are stored in D1.
- admin.html requests the ADMIN_KEY and displays all submissions.
- The Reset tab requires typing RESET, then confirmation, before deleting the complete partner list.
- CSV export is available from the Partner List tab.

SECURITY
Do not put your real ADMIN_KEY inside any HTML or JavaScript file. Keep it only as a Cloudflare secret/environment variable.
