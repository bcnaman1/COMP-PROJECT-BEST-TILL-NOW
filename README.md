# Render Shop

The assistant bubble uses Groq's OpenAI-compatible API.

## Run locally on Windows PowerShell

From this project folder:

```powershell
$env:GROQ_API_KEY="your_groq_key"
$env:GROQ_MODEL="llama-3.3-70b-versatile"
$env:PORT="8787"
node server.js
```

Then open `http://localhost:8787`.

Keep the terminal open while using the site. Do not put the API key in HTML, CSS, JavaScript, or GitHub. Groq offers a free tier, but it has rate limits and may change its terms.

