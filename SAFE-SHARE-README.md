# Safe Second Brain share package

This package intentionally contains:
- No Netlify token
- No site ID from another user
- No note data
- No hardcoded Blob store fallback
- No password hash from another user

Before deploy, each recipient must set unique env vars:

```bash
SB_BLOBS_STORE=second-brain-store-<recipient>-<timestamp>
SB_BLOBS_SITE_ID=<recipient netlify site id>
SB_BLOBS_TOKEN=<recipient netlify token>
SB_LOGIN_PASSWORD_SHA256=<sha256 password>
SB_AUTH_SECRET=<random 32+ char secret>
```

Public API should return `401 auth required` before login:

```bash
curl https://YOUR_DOMAIN/.netlify/functions/list-notes
```

Never share `.env`, Netlify tokens, cookie/session files, or exported notes.
