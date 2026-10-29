# EzyEnquiry Company Web

React and Vite frontend for the company ERP portal.

## Development

The company backend runs on port `5001` by default in this workspace. Start it, then run the frontend:

```bash
npm run dev
```

Set `VITE_API_URL` to the company backend API base URL when deploying (for example, `https://your-company-backend.example.com/api`). The frontend defaults to `http://localhost:5001/api` for local development so company registrations use the company-web backend.

## Build

```bash
npm run build
```
