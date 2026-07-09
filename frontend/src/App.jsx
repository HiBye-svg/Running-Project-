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
  Legend,
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
  const [showFounder, setShowFounder] = useState(false);
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

  async function clearHistory() {
  const confirmed = window.confirm(
    "Are you sure you want to clear your run history?"
  );

  if (!confirmed) return;

  try {
    await fetch("https://hibye-svg-perfect-path-backend.hf.space/history", {
      method: "DELETE",
    });

    setHistory([]);
  } catch (error) {
    console.error("Failed to clear history:", error);
  }
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
  feedback: result.feedback,
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
      overstride: 0,
      forwardLean: 0,
      armStiffness: 0,
      sideSway: 0,
    };

    run.issues?.forEach((issue) => {
      const name = issue.issue.toLowerCase();
      const value =
        typeof issue.frequency_percent === "number"
          ? issue.frequency_percent
          : issue.detected
          ? 100
          : 0;

      if (name.includes("overstride")) row.overstride = value;
      if (name.includes("forward lean")) row.forwardLean = value;
      if (name.includes("elbow") || name.includes("arm")) row.armStiffness = value;
      if (name.includes("sway")) row.sideSway = value;
    });

    return row;
  });
};
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip">
      <p className="tooltip-title">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="tooltip-row">
          <span
            className="tooltip-dot"
            style={{ backgroundColor: item.color }}
          ></span>
          {item.name}: <strong>{item.value}%</strong>
        </p>
      ))}
    </div>
  );
};
  return (
  <div className="app-shell">
    <nav className="navbar">
  <button className="brand-button" onClick={goHome}>
    <span className="brand-mark">PP</span>
    <span>Perfect Path</span>
  </button>

  <div className="nav-actions">
    <button className="nav-link" onClick={() => setShowFounder(true)}>
      About Founder
    </button>
  <a
  className="nav-link feedback-btn"
  href="https://docs.google.com/forms/d/e/1FAIpQLSdJ82zRjynBXSyw9cUJ31wQ93BZx0iVizn14pv3bFZqClmkxA/viewform?usp=dialog"
  target="_blank"
  rel="noopener noreferrer"
>
  Feedback
</a>
    {user ? (
      <button className="nav-link nav-signin" onClick={logout}>
        Sign out
      </button>
    ) : (
      <button className="nav-link nav-signin" onClick={loginWithGoogle}>
        Sign in
      </button>
    )}
  </div>
</nav>

{showFounder && (
  <div className="modal-backdrop" onClick={() => setShowFounder(false)}>
    <div className="founder-modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setShowFounder(false)}>
        ×
      </button>

      <p className="eyebrow">About Founder</p>
      <h2>Built by a high school runner.</h2>
      <p>
        Perfect Path was created by Hrudhay, a high school runner from San Jose.
        After seeing how small form issues could lead to pain, missed races, and
        confusion for newer runners, I built Perfect Path to help runners better
        understand their form, track improvement, and get shoe suggestions based
        on their form.
      </p>
    </div>
  </div>
)}


      {screen === "home" && (
  <main className="home home-v2">
    <section className="sunrise-hero">
      <div className="sunrise-bg"></div>
      <div className="sunrise-mountains back"></div>
      <div className="sunrise-mountains front"></div>
      <div className="hero-birds">
  <span></span>
  <span></span>
  <span></span>
</div>
      <div className="sunrise-trail"></div>

      <div className="hero-runner">
        <span className="head"></span>
        <span className="body"></span>
        <span className="arm arm-left"></span>
        <span className="arm arm-right"></span>
        <span className="leg leg-left"></span>
        <span className="leg leg-right"></span>
      </div>

      <div className="hero-content-v2">
  <h1>
    Find Your
    <span>Perfect Path</span>
  </h1>

  <p>
    Upload a 10 second running clip and receive personalized guidance to improve
    your form and get shoes targeted for you.
  </p>
</div>  

<section className="mode-grid mode-grid-v2">
        <button className="mode-card road-card" onClick={() => chooseRun("road")}>
          <div className="mode-icon">
            
          </div>
          <h2>Normal Run</h2>
          <p>Best for road runs, track workouts, and easy runs.</p>
          <span>Analyze road form →</span>
        </button>

        <button className="mode-card trail-card" onClick={() => chooseRun("flat_trail")}>
          <div className="mode-icon"></div>
          <h2>Flat Trail</h2>
          <p>For flatter trails where terrain varies but not a significant elevation gain.</p>
          <span>Analyze flat trail →</span>
        </button>

        <button className="mode-card hill-card" onClick={() => chooseRun("trail_hill")}>
          <div className="mode-icon"></div>
          <h2>Hill Trail</h2>
          <p>For uphill trail clips.</p>
          <span>Analyze hill form →</span>
        </button>
      </section>

      <div className="hero-feature-strip">
        <div>Accurate Analysis</div>
        <div>Clear Guidance</div>
        <div>Your Best Run</div>
      </div>
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

              {video && (
  <p className="selected-file">✓ {video.name}</p>
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

<div className="footprints">
  <span></span>
  <span></span>
  <span></span>
  <span></span>
</div>
              <div className="mini-tree left-tree"></div>
              <div className="mini-tree right-tree"></div>
            </div>

            <h2>Analyzing your run...</h2>
            <p>
              Wait around 2 minutes and 30 seconds for video to finish analyzing
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

          <p className="issue-frequency">{issue.frequency_percent}%</p>
          <p className="issue-time">
            {issue.time_ranges.length > 0
              ? issue.time_ranges.join(", ")
              : "No major time range"}
          </p>
        </div>
      ))}
    </section>

   <section className="feedback-card">
  <div className="history-header">
    <h2>Progress Graph</h2>
    <button className="clear-history-btn" onClick={clearHistory}>
      Clear History
    </button>
  </div>

  <p>Tracks your form trends across your recent runs.</p>

  <div className="chart-box">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={buildChartData()}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
        <XAxis dataKey="run" />
        <YAxis domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="top" height={36} />

        <Line type="monotone" dataKey="overstride" name="Overstride" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 5 }} activeDot={{ r: 8 }} isAnimationActive animationDuration={1200} animationBegin={0} animationEasing="ease-out" />
        <Line type="monotone" dataKey="forwardLean" name="Forward Lean" stroke="#EC4899" strokeWidth={4} dot={{ r: 5 }} activeDot={{ r: 8 }} isAnimationActive animationDuration={1200} animationBegin={150} animationEasing="ease-out" />
        <Line type="monotone" dataKey="armStiffness" name="Arm Stiffness" stroke="#3B82F6" strokeWidth={4} dot={{ r: 5 }} activeDot={{ r: 8 }} isAnimationActive animationDuration={1200} animationBegin={300} animationEasing="ease-out" />
        <Line type="monotone" dataKey="sideSway" name="Side Sway" stroke="#10B981" strokeWidth={4} dot={{ r: 5 }} activeDot={{ r: 8 }} isAnimationActive animationDuration={1200} animationBegin={450} animationEasing="ease-out" />
      </LineChart>
    </ResponsiveContainer>
  </div>
</section>
    <section className="feedback-card">
      <h2>AI Feedback</h2>
      <p>{result.feedback}</p>
    </section>

    <section className="shoe-card">
      <div>
        <p className="eyebrow">Optional</p>
        <h2>Shoe Suggestions</h2>
        <p>Select your foot width to get three shoe options from the database.</p>
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