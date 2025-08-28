"use strict";

// Configuration
const API_KEY = "IHIWV7V028G49KNK"; // Provided by user
const API_URL = "https://www.alphavantage.co/query";

// DOM Elements
const form = document.getElementById("ticker-form");
const input = document.getElementById("ticker-input");
const statusEl = document.getElementById("status");
const infoTicker = document.getElementById("info-ticker");
const infoDate = document.getElementById("info-date");
const infoPrice = document.getElementById("info-price");
const infoScore = document.getElementById("info-score");
const feedbackEl = document.getElementById("feedback");
const btnUp = document.getElementById("btn-up");
const btnDown = document.getElementById("btn-down");
const btnEnd = document.getElementById("btn-end");

// Chart
const ctx = document.getElementById("price-chart");
let priceChart = null;

// State
let selectedTicker = null;
let datesAsc = [];
let closeByDate = new Map();
let score = 0;
let gameActive = false;

// Gameplay indices
// anchorIndex: index of the hidden anchor date from which we predict the next day movement
// revealIndex: latest index that has been revealed on the chart (and in the UI)
let anchorIndex = -1;
let revealIndex = -1;

function setStatus(message, variant = "info") {
  statusEl.textContent = message || "";
  statusEl.style.color = variant === "error" ? "#ef4444" : "#b7c1e1";
}

function setFeedback(message, variant = "info") {
  feedbackEl.textContent = message || "";
  feedbackEl.style.color = variant === "error" ? "#ef4444" : variant === "success" ? "#22c55e" : "#b7c1e1";
}

function resetUI() {
  infoTicker.textContent = "—";
  infoDate.textContent = "—";
  infoPrice.textContent = "—";
  infoScore.textContent = "0";
  setFeedback("");
  score = 0;
  gameActive = false;
  anchorIndex = -1;
  revealIndex = -1;
  btnUp.disabled = true;
  btnDown.disabled = true;
  btnEnd.disabled = true;
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }
}

async function fetchDailySeries(ticker) {
  // Try adjusted first, fall back to non-adjusted if necessary
  const tryFetch = async (fnName) => {
    const url = new URL(API_URL);
    url.searchParams.set("function", fnName);
    url.searchParams.set("symbol", ticker);
    url.searchParams.set("outputsize", "compact");
    url.searchParams.set("apikey", API_KEY);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error(`Network error: ${resp.status}`);
    }
    const data = await resp.json();
    if (data && typeof data === "object") {
      if (data.Note) {
        throw new Error(data.Note);
      }
      if (data.Information) {
        throw new Error(data.Information);
      }
      if (data["Error Message"]) {
        throw new Error("Invalid ticker symbol. Please try a different one.");
      }
      const series = data["Time Series (Daily)"];
      if (series) return series;
    }
    // If we reach here, unexpected shape
    throw new Error("Unexpected API response. Try again later.");
  };

  try {
    return await tryFetch("TIME_SERIES_DAILY_ADJUSTED");
  } catch (e) {
    // If adjusted fails due to function-specific issues, try non-adjusted
    try {
      return await tryFetch("TIME_SERIES_DAILY");
    } catch (e2) {
      // Prefer the latest error message surfaced to the user
      throw e2 instanceof Error ? e2 : e;
    }
  }
}

function buildSortedDates(seriesObj) {
  // Alpha Vantage keys are YYYY-MM-DD
  const dateStrings = Object.keys(seriesObj);
  dateStrings.sort((a, b) => new Date(a) - new Date(b)); // ascending
  return dateStrings;
}

function getClose(seriesObj, dateStr) {
  const o = seriesObj[dateStr];
  if (!o) return null;
  // Prefer adjusted close when available
  const closeStr = o["5. adjusted close"] || o["4. close"];
  return closeStr ? Number(closeStr) : null;
}

function daysAgo(dateStr) {
  const today = new Date();
  const date = new Date(dateStr + "T00:00:00Z");
  const diffMs = today.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isWeekday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  return day !== 0 && day !== 6; // not Sun/Sat
}

function chooseRandomStartIndex(dateListAsc) {
  // Choose a non-holiday weekday between 7 and 100 days ago that also has >=7 prior trading days and at least one following trading day
  const eligible = [];
  for (let i = 0; i < dateListAsc.length; i++) {
    const d = dateListAsc[i];
    const ago = daysAgo(d);
    if (ago >= 7 && ago <= 100 && i >= 7 && i < dateListAsc.length - 1 && isWeekday(d)) {
      eligible.push(i);
    }
  }
  if (eligible.length === 0) return -1;
  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx];
}

function initChart(initialLabels, initialData, ticker) {
  const gridColor = "rgba(231, 237, 255, 0.08)";
  const textColor = "#b7c1e1";
  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: initialLabels,
      datasets: [
        {
          label: `${ticker} Close Price`,
          data: initialData,
          borderColor: "#7aa2ff",
          backgroundColor: "rgba(122, 162, 255, 0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: textColor, maxRotation: 0 },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
      },
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: {
          callbacks: {
            label: (ctx) => `Close: ${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
    },
  });
}

function updateInfoPanel(currentIndexToShow) {
  const d = datesAsc[currentIndexToShow] || "—";
  const p = d && closeByDate.has(d) ? closeByDate.get(d) : null;
  infoDate.textContent = d || "—";
  infoPrice.textContent = p != null ? `$${p.toFixed(2)}` : "—";
}

function appendPoint(dateStr) {
  if (!priceChart) return;
  const p = closeByDate.get(dateStr);
  priceChart.data.labels.push(dateStr);
  priceChart.data.datasets[0].data.push(p);
  priceChart.update();
}

function enableGameControls(enabled) {
  btnUp.disabled = !enabled;
  btnDown.disabled = !enabled;
  btnEnd.disabled = !enabled;
}

async function startGame(tickerRaw) {
  resetUI();
  setStatus("Fetching data…");
  const ticker = tickerRaw.trim().toUpperCase();
  if (!ticker) {
    setStatus("Please enter a stock ticker.", "error");
    return;
  }
  selectedTicker = ticker;
  infoTicker.textContent = ticker;

  try {
    const series = await fetchDailySeries(ticker);
    // Build date list and close map
    datesAsc = buildSortedDates(series);
    closeByDate = new Map();
    for (const d of datesAsc) {
      const c = getClose(series, d);
      if (c != null) closeByDate.set(d, c);
    }

    // Choose random start date index
    const chosen = chooseRandomStartIndex(datesAsc);
    if (chosen === -1) {
      throw new Error("Insufficient data to select a valid start date. Try another ticker.");
    }
    anchorIndex = chosen; // hidden anchor date
    revealIndex = anchorIndex - 1; // latest revealed is the day before the start date

    // Prepare initial 7 trading days before the start date
    const windowStart = anchorIndex - 7;
    const labels = datesAsc.slice(windowStart, anchorIndex);
    const data = labels.map((d) => closeByDate.get(d));
    initChart(labels, data, ticker);

    // Update info panel to reflect the latest revealed date (day before start)
    updateInfoPanel(revealIndex);

    gameActive = true;
    enableGameControls(true);
    setStatus(`Game started. Random start date selected. Make your first prediction for the day after the start date.`);
  } catch (err) {
    console.error(err);
    resetUI();
    setStatus(err.message || "Failed to load data.", "error");
  }
}

function handlePrediction(direction) {
  if (!gameActive) return;
  // Determine correctness by comparing next day vs anchor day
  const nextIndex = anchorIndex + 1;
  if (nextIndex >= datesAsc.length) {
    setFeedback("No more future data available. Ending game.", "error");
    enableGameControls(false);
    gameActive = false;
    return;
  }
  const startDate = datesAsc[anchorIndex];
  const nextDate = datesAsc[nextIndex];
  const startClose = closeByDate.get(startDate);
  const nextClose = closeByDate.get(nextDate);

  const wentUp = nextClose > startClose;
  const guessedUp = direction === "up";
  const correct = (wentUp && guessedUp) || (!wentUp && !guessedUp);
  if (correct) {
    score += 1;
    setFeedback(`Correct! ${selectedTicker} ${wentUp ? "rose" : "fell"} to $${nextClose.toFixed(2)} on ${nextDate}.`, "success");
  } else {
    setFeedback(`Wrong. ${selectedTicker} ${wentUp ? "rose" : "fell"} to $${nextClose.toFixed(2)} on ${nextDate}.`, "error");
  }
  infoScore.textContent = String(score);

  // Reveal the next day price on the chart
  appendPoint(nextDate);
  revealIndex = nextIndex;
  updateInfoPanel(revealIndex);

  // Advance anchor to the day we just revealed so the next prediction compares against it
  anchorIndex = nextIndex;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  startGame(input.value);
});

btnUp.addEventListener("click", () => handlePrediction("up"));
btnDown.addEventListener("click", () => handlePrediction("down"));
btnEnd.addEventListener("click", () => {
  if (!gameActive) return;
  gameActive = false;
  enableGameControls(false);
  setFeedback("Game ended. You can enter a ticker to start again.");
});

