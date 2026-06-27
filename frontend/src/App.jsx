import { useState } from "react";
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("home");
  const [user, setUser] = useState(null);
  const [runType, setRunType] = useState(null);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [footWidth, setFootWidth] = useState("");
  const [shoeSuggestions, setShoeSuggestions] = useState(null);
  const [history, setHistory] = useState([]);
  async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    setUser(result.user);
  } catch (error) {
    console.error(error);
    alert("Google sign-in failed.");
  }
}

async function logout() {
  await signOut(auth);
  setUser(null);
}

  function chooseRun(type) {
    setRunType(type);
    setVideo(null);
    setResult(null);
    setShoeSuggestions(null);
    setFootWidth("");
    setScreen("analyze");
  }

  async function analyzeRun() {
    if (!video) {
      alert("Please choose a video first.");
      return;
    }

    setLoading(true);
    setScreen("loading");
    setResult(null);
    setShoeSuggestions(null);

    const formData = new FormData();
    formData.append("file", video);
    formData.append("run_type", runType);

    try {
     const response = await fetch("https://hibye-svg-perfect-path-backend.hf.space/analyze", {
  method: "POST",
  body: formData,
});

      const data = await response.json();

      setResult(data);
      const historyResponse = await fetch("https://hibye-svg-perfect-path-backend.hf.space/history");
const historyData = await historyResponse.json();
setHistory(historyData.history);
      setScreen("results");
    } catch (error) {
      alert("Something went wrong while analyzing. Check your backend terminal.");
      setScreen("analyze");
    }

    setLoading(false);
  }

  async function getShoeSuggestions() {
    if (!footWidth) {
      alert("Please select your foot width first.");
      return;
    }

    if (!result) {
      alert("Please analyze a run first.");
      return;
    }

    try {
      const response = await fetch("https://hibye-svg-perfect-path-backend.hf.space/shoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foot_width: footWidth,
          issues: result.issues,
          run_type: runType,
        }),
      });

      const data = await response.json();
      setShoeSuggestions(data.shoes);
    } catch (error) {
      alert("Could not get shoe suggestions. Check your backend terminal.");
    }
  }

  function goHome() {
    setScreen("home");
    setRunType(null);
    setVideo(null);
    setResult(null);
    setShoeSuggestions(null);
    setFootWidth("");
  }

  function goBackToAnalyze() {
    setScreen("analyze");
    setResult(null);
    setShoeSuggestions(null);
    setFootWidth("");
  }

  const isTrail =
  runType === "trail_hill" ||
  runType === "flat_trail";
const buildChartData = () => {
  return history.slice(-6).map((run, index) => {
    const row = {
      run: `Run ${index + 1}`,
    };

    run.issues.forEach((issue) => {
      row[issue.issue.replace("Possible ", "")] =
        typeof issue.frequency_percent === "number"
          ? issue.frequency_percent
          : issue.detected
          ? 100
          : 0;
    });

    return row;
  });
}
  return (
    <div className="app-shell">
      <div className="forest-bg">
        <div className="tree tree-one"></div>
        <div className="tree tree-two"></div>
        <div className="tree tree-three"></div>
        <div className="tree tree-four"></div>
      </div>

      <nav className="navbar">
        <button className="brand-button" onClick={goHome}>
          <span className="brand-mark">PP</span>
          <span>Perfect Path</span>
        </button>

        <div className="nav-pill">70+ shoe choices</div>
      </nav>

      {screen === "home" && (
        <main className="home">
          <section className="hero">
            <p className="eyebrow">AI-assisted running form analysis</p>
            <h1>Find your own Perfect Path.</h1>
            <p className="hero-copy">
              Upload a 10 second  video, review your form, track improvement,
              and get shoe suggestions built around your run type.
            </p>
          </section>

    <section className="login-section">
  {user ? (
    <div className="user-pill">
      <span>👋 {user.displayName}</span>
      <button onClick={logout}>Sign out</button>
    </div>
  ) : (
    <button className="google-button" onClick={loginWithGoogle}>
      <span className="google-logo">G</span>
Sign in with Google
    </button>
  )}
</section>
          <section className="mode-grid three-modes">
            <button className="mode-card road-card" onClick={() => chooseRun("road")}>
              <div className="mode-icon">🏃</div>
              <h2>Normal Run</h2>
              <p>Best for road runs, track workouts, and easy runs.</p>
              <span>Analyze road form →</span>
            </button>

            <button className="mode-card trail-card" onClick={() => chooseRun("flat_trail")}>
              <div className="mode-icon">🌲</div>
              <h2>Flat Trail</h2>
              <p>For flatter trails where terrain varies but not a significant elevation gain.</p>
              <span>Analyze flat trail →</span>
            </button>

            <button className="mode-card hill-card" onClick={() => chooseRun("trail_hill")}>
              <div className="mode-icon">⛰️</div>
              <h2>Hill Trail</h2>
              <p>For uphill trail clip.</p>
              <span>Analyze hill form →</span>
            </button>
          </section>

<section className="feedback-section">
  <h2>Help Improve Perfect Path</h2>

  <p>
    Found a bug, have a feature request, or just want to share your
    experience? We'd love to hear from you.
  </p>

  <a
    href="https://docs.google.com/forms/d/e/1FAIpQLSdJ82zRjynBXSyw9cUJ31wQ93BZx0iVizn14pv3bFZqClmkxA/viewform"
    target="_blank"
    rel="noopener noreferrer"
    className="feedback-button"
  >
    💬 Give Feedback
  </a>
</section>

</main>
      )}

      {screen === "analyze" && (
        <main className="analysis-page">
          <button className="back-button" onClick={goHome}>
            ← Back
          </button>

          <section className="analysis-card">
            <p className="eyebrow">{isTrail ? "Trail / Hill Mode" : "Normal Run Mode"}</p>
            <h1>{isTrail ? "Analyze your trail form." : "Analyze your road form."}</h1>
            <p>
              {isTrail
                ? "Trail mode uses more forgiving thresholds for lean, stride, and terrain movement."
                : "Road mode checks common form patterns like overstride, forward lean, elbows, and side sway."}
            </p>

            <div className="upload-zone">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideo(e.target.files[0])}
              />

              {video ? (
                <p className="selected-file">Selected: {video.name}</p>
              ) : (
                <p className="selected-file muted">No video selected yet.</p>
              )}

              <button className="primary-button" onClick={analyzeRun} disabled={loading}>
                Analyze Run
              </button>
            </div>
          </section>
        </main>
      )}

      {screen === "loading" && (
        <main className="loading-page">
          <div className="loading-card">
            <div className="runner-scene">
              <div className="sun"></div>
              <div className="path"></div>
              <div className="runner">🏃</div>
              <div className="mini-tree left-tree"></div>
              <div className="mini-tree right-tree"></div>
            </div>

            <h2>Analyzing your run...</h2>
            <p>
              Perfect Path is checking movement patterns, comparing your run, and preparing feedback.
            </p>

            <div className="loading-bar">
              <div></div>
            </div>
          </div>
        </main>
      )}

      {screen === "results" && result && (
        <main className="results-page">
          <div className="results-header">
            <button className="back-button" onClick={goBackToAnalyze}>
              ← Analyze another
            </button>
            <button className="back-button" onClick={goHome}>
              Home
            </button>
          </div>

          <section className="results-title">
            <p className="eyebrow">{isTrail ? "Trail / Hill Results" : "Normal Run Results"}</p>
            <h1>Your analysis is ready.</h1>
            <p>
              {isTrail
                ? "Trail movement is judged differently because hills and uneven ground naturally change form."
                : "Road movement is analyzed using your standard form metrics."}
            </p>
          </section>

          <section className="issue-grid">
            {result.issues.map((issue, index) => (
              <div
                className={`issue-card ${issue.detected ? "issue-detected" : "issue-clear"}`}
                key={index}
              >
                <div className="issue-top">
                  <h3>{issue.issue.replace("Possible ", "")}</h3>
                  <span>{issue.detected ? "Detected" : "Clear"}</span>
                </div>
<section className="feedback-card">
  <h2>Progress Graph</h2>
  <p>Tracks your form trends across your recent runs.</p>

  <div className="chart-box">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={buildChartData()}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="run" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="overstride" name="Overstride" strokeWidth={3} />
        <Line type="monotone" dataKey="forwardLean" name="Forward Lean" strokeWidth={3} />
        <Line type="monotone" dataKey="armStiffness" name="Arm Stiffness" strokeWidth={3} />
        <Line type="monotone" dataKey="sideSway" name="Side Sway" strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  </div>
</section>
                <p className="issue-frequency">{issue.frequency_percent}%</p>
                <p className="issue-time">
                  {issue.time_ranges.length > 0
                    ? issue.time_ranges.join(", ")
                    : "No major time range"}
                </p>
              </div>
            ))}
          </section>

          <p className="disclaimer">
            Results are based on video movement analysis and are not medical or diagnostic advice.
          </p>

          <section className="feedback-card">
            <h2>AI Feedback</h2>
            <p>{result.feedback}</p>
          </section>

          <section className="shoe-card">
            <div>
              <p className="eyebrow">Optional</p>
              <h2>Shoe Suggestions</h2>
              <p>
                Select your foot width to get three shoe options from the database.
              </p>
            </div>

            <div className="shoe-controls">
              <select value={footWidth} onChange={(e) => setFootWidth(e.target.value)}>
                <option value="">Select foot width</option>
                <option value="narrow">Narrow</option>
                <option value="regular">Regular</option>
                <option value="wide">Wide</option>
                <option value="extra wide">Extra Wide</option>
              </select>

              <button className="primary-button" onClick={getShoeSuggestions}>
                Get Shoe Suggestions
              </button>
            </div>

            {shoeSuggestions && (
              <div className="shoe-grid">
                {shoeSuggestions.map((shoe, index) => (
                  <div className="shoe-result-card" key={index}>
                    <span className="shoe-tier">{shoe.tier}</span>
                    <h3>
                      {shoe.brand} {shoe.model}
                    </h3>
                    <p>{shoe.category}</p>
                    <strong>${shoe.price}</strong>
                    <p>{shoe.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
          </main>
      )}
    </div>
  );
}

export default App;