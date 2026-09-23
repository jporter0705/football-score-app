# ChatGPT mobile bet import

This branch adds a phone-friendly, no-per-bet-deploy import flow.

## Flow

1. ChatGPT extracts bets from screenshots and builds a payload shaped as `{ week: { start: 'YYYY-MM-DD' }, bets: [...] }`.
2. ChatGPT base64url-encodes the UTF-8 JSON and links to `/import.html#bets=<payload>`.
3. The URL fragment is not sent to the server in the HTTP request. `import.html` decodes it locally and displays a review screen.
4. If the football app session is locked, the page asks for the existing private-bet access key and authenticates through `/api/session`.
5. The user taps **Add bets**. The page POSTs the decoded JSON to same-origin `/api/chat-import` using the HttpOnly session cookie.
6. `/api/chat-import` validates the payload and merges it into the existing `football-private-bets` Netlify Blob for that Tuesday betting week.
7. The fragment is removed from browser history after a successful save.

## Security

- No `BET_IMPORT_TOKEN` is put in ChatGPT or an import URL.
- The import endpoint requires the existing signed HttpOnly football session.
- The endpoint enforces same-origin requests.
- Bet data travels in the URL fragment, which browsers do not send in the initial HTTP request. It is decoded client-side.
- The import page requires an explicit review + Add bets tap; opening a link alone cannot write data.
- Existing `mergeBets` behavior makes repeated imports with the same bet IDs safe to merge rather than blindly append duplicates.

## Deployment/testing

Deploy this branch (or merge it into the branch Netlify deploys), then test a link of the form:

`https://<football-app-host>/import.html#bets=<base64url-encoded-json>`

The first real test payload should use betting week `2026-09-15` and BetOnline IDs `997883663-1` and `997883663-2` from the 2026-09-19 Bears/Vikings screenshots.
