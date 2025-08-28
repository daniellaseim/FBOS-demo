# Stock Market Prediction Game

A static web game deployed to GitHub Pages. Enter any valid stock ticker and guess whether the next day's price goes up or down. Uses live daily data from Alpha Vantage.

## Features

- Live data from Alpha Vantage (no demo data)
- Random start date between 7 and 100 days ago (trading weekday)
- Chart of the 7 trading days preceding the start date
- Predict Up/Down, reveal next day, score increments on correct guesses
- Continues until you end the game or data runs out

## Local Development

Open `index.html` in a browser via a simple local server (to avoid CORS issues for some browsers):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## GitHub Pages Deployment

1. Create a new repository and push these files.
2. In your repository settings:
   - Navigate to Pages
   - Build and deployment: Source = "Deploy from a branch"
   - Branch: `main` (or `master`), folder `/ (root)`
3. Save. Wait for Pages to build. Your site will be available at the URL shown in the Pages section.

If your repository uses a different default branch, adjust the selection accordingly.

## Alpha Vantage API Key

This demo uses an API key embedded in `app.js` for simplicity. For personal forks, obtain your own free API key from Alpha Vantage and replace the value in `app.js`.

# FBOS-demo
FBOS Beehive Demo
