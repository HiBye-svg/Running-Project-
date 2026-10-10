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
import { useEffect, useRef, useState } from "react";
import {
  Award,
  Crown,
  BadgeDollarSign,
  ShieldCheck,
  Footprints,
  Activity,
  Check,
} from "lucide-react";

function App() {
  const [screen, setScreen] = useState("home");
  const [previewTerrain, setPreviewTerrain] = useState("road");
  const [dragActive, setDragActive] = useState(false);
  const [user, setUser] = useState(null);
  const [runType, setRunType] = useState(null);
  const [video, setVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
const [videoFrames, setVideoFrames] = useState([]);
const [frameTime, setFrameTime] = useState(0);
const [frameError, setFrameError] = useState(false);
const previewVideoRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [footWidth, setFootWidth] = useState("");
  const [shoeSuggestions, setShoeSuggestions] = useState(null);
  const [history, setHistory] = useState([]);
  const [showFounder, setShowFounder] = useState(false);
  const [showProcess, setShowProcess] = useState(false);
  const [activeDmaic, setActiveDmaic] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingSteps = [
  "Video uploaded",
  "Processing footage",
  "Analyzing running form",
  "Preparing results",
];
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
useEffect(() => {
  if (screen !== "loading") {
    return;
  }

  setLoadingStep(0);

  const interval = setInterval(() => {
    setLoadingStep((currentStep) =>
      Math.min(currentStep + 1, loadingSteps.length - 1)
    );
  }, 40000);

  return () => clearInterval(interval);
}, [screen]);

useEffect(() => {
  if (!video) {
    setVideoUrl("");
    setVideoFrames([]);
    setFrameTime(0);
    setFrameError(false);
    return;
  }

  let cancelled = false;
  const url = URL.createObjectURL(video);
  const extractor = document.createElement("video");

  setVideoUrl(url);
  setVideoFrames([]);
  setFrameTime(0);
  setFrameError(false);

  extractor.preload = "auto";
  extractor.muted = true;
  extractor.playsInline = true;
  extractor.src = url;

  const waitForEvent = (element, eventName) =>
    new Promise((resolve, reject) => {
      const onSuccess = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error("Could not read the video."));
      };

      const cleanup = () => {
        element.removeEventListener(eventName, onSuccess);
        element.removeEventListener("error", onError);
      };

      element.addEventListener(eventName, onSuccess, { once: true });
      element.addEventListener("error", onError, { once: true });
    });

  async function extractFrames() {
    try {
      if (extractor.readyState < 1) {
        const metadataReady = waitForEvent(
          extractor,
          "loadedmetadata"
        );
        extractor.load();
        await metadataReady;
      }

      if (cancelled) return;

      const duration = extractor.duration;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Video duration unavailable.");
      }

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas unavailable.");
      }

      const aspect =
        extractor.videoWidth / extractor.videoHeight || 16 / 9;

      canvas.width = 200;
      canvas.height = Math.max(
        80,
        Math.round(canvas.width / aspect)
      );

      const frames = [];
      const count = 8;

      for (let i = 0; i < count; i++) {
        if (cancelled) return;

        const time = Math.min(
          duration * ((i + 0.5) / count),
          Math.max(0, duration - 0.05)
        );

        const seekReady = waitForEvent(extractor, "seeked");
        extractor.currentTime = time;
        await seekReady;

        if (cancelled) return;

        context.drawImage(
          extractor,
          0,
          0,
          canvas.width,
          canvas.height
        );

        frames.push({
          time,
          image: canvas.toDataURL("image/jpeg", 0.75),
        });
      }

      if (!cancelled) {
        setVideoFrames(frames);
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Frame extraction failed:", error);
        setFrameError(true);
      }
    }
  }

  extractFrames();

  return () => {
    cancelled = true;
    extractor.removeAttribute("src");
    extractor.load();
    URL.revokeObjectURL(url);
  };
}, [video]);

function seekToFrame(time) {
  if (!previewVideoRef.current) return;

  previewVideoRef.current.currentTime = time;
  setFrameTime(time);
}

function handleVideoFile(file) {
  if (!file) return;

  if (!file.type.startsWith("video/")) {
    alert("Please choose a video file.");
    return;
  }

  setVideo(file);
}

function handleDrop(event) {
  event.preventDefault();
  setDragActive(false);

  const droppedFile = event.dataTransfer.files?.[0];
  handleVideoFile(droppedFile);
}

function handleDragOver(event) {
  event.preventDefault();
  setDragActive(true);
}

function handleDragLeave(event) {
  event.preventDefault();
  setDragActive(false);
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

const historyResponse = await fetch(
  "https://hibye-svg-perfect-path-backend.hf.space/history"
);

const historyData = await historyResponse.json();

setHistory(historyData.history);
setLoadingStep(loadingSteps.length);

setTimeout(() => {
  setScreen("results");
}, 500);

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

  const isFlatTrail = runType === "flat_trail";
const isHillTrail = runType === "trail_hill";
const isTrail = isFlatTrail || isHillTrail;
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
const getShoeTierInfo = (tier, index) => {
  const normalizedTier = tier?.toLowerCase() || "";

  if (normalizedTier.includes("budget") || index === 0) {
    return {
      label: "Value Pick",
      className: "value-pick",
      icon: BadgeDollarSign,
    };
  }

  if (normalizedTier.includes("premium") || index === 2) {
    return {
      label: "Premium Choice",
      className: "premium-choice",
      icon: Crown,
    };
  }

  return {
    label: "Best Overall",
    className: "best-overall",
    icon: Award,
  };
};

const getShoeFeatures = (shoe) => {
  const reason = shoe.reason?.toLowerCase() || "";
  const features = [];

  if (
    reason.includes("wide") ||
    footWidth === "wide" ||
    footWidth === "extra wide"
  ) {
    features.push({
      text:
        footWidth === "extra wide"
          ? "Extra-wide fit support"
          : "Wide fit available",
      icon: Footprints,
    });
  }

  if (
    shoe.category?.toLowerCase().includes("stability") ||
    reason.includes("stability") ||
    reason.includes("support")
  ) {
    features.push({
      text: "Stability-focused support",
      icon: ShieldCheck,
    });
  }

  if (reason.includes("overstride")) {
    features.push({
      text: "Selected for overstride support",
      icon: Activity,
    });
  }

  if (reason.includes("forward lean")) {
    features.push({
      text: "Supports more controlled form",
      icon: Check,
    });
  }

  if (runType === "trail_hill" || runType === "flat_trail") {
    features.push({
      text: "Suitable for trail running",
      icon: Activity,
    });
  }

  if (features.length < 3) {
    features.push({
      text: `${shoe.category} running design`,
      icon: Check,
    });
  }

  if (features.length < 3) {
    features.push({
      text: "Matched to your analysis",
      icon: Check,
    });
  }

  return features.slice(0, 3);
};
  return (
  <div className="app-shell">

{screen !== "home" && (
  <nav className="navbar">
    <button className="brand-button" onClick={goHome}>
      <span className="brand-mark">PP</span>
      <span>Perfect Path</span>
    </button>

    <div className="nav-actions">
      <button
        className="nav-link"
        onClick={() => setShowFounder(true)}
      >
        About Founder
      </button>

      <button
        className="nav-link"
        onClick={() => setShowProcess(true)}
      >
        Development Process
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
)}

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

{showProcess && (
  <div
    className="modal-backdrop pp-dmaic-backdrop"
    onClick={() => setShowProcess(false)}
  >
    <section
      className="pp-dmaic-modal"
      onClick={(e) => e.stopPropagation()}
      aria-label="PerfectPath development process"
    >
      <button
        className="pp-dmaic-close"
        type="button"
        aria-label="Close development process"
        onClick={() => setShowProcess(false)}
      >
        ×
      </button>

      <header className="pp-dmaic-header">
        <p>DEVELOPMENT PROCESS</p>
        <h2>How PerfectPath Was Built</h2>
        <span>LEAN SIX SIGMA / DMAIC</span>
      </header>

      <nav className="pp-dmaic-nav" aria-label="DMAIC stages">
        {[
          ["D", "DEFINE"],
          ["M", "MEASURE"],
          ["A", "ANALYZE"],
          ["I", "IMPROVE"],
          ["C", "CONTROL"],
        ].map(([letter, name], index) => (
          <button
            key={letter}
            type="button"
            className={`pp-dmaic-tab ${
              activeDmaic === index ? "is-active" : ""
            }`}
            onClick={() => setActiveDmaic(index)}
            aria-pressed={activeDmaic === index}
          >
            <strong>{letter}</strong>
            <span>{name}</span>
          </button>
        ))}
      </nav>

      <div className="pp-dmaic-content">
        {activeDmaic === 0 && (
          <article>
            <span className="pp-dmaic-phase">DEFINE</span>
            <h3>Why I started PerfectPath</h3>

            <p>
              My body never properly recovered during my first year
              of cross country, which was very different from the
              jogs I had done before. I realized that both my shoes
              and running form were contributing to the problem,
              and I watched teammates miss races because of
              preventable injuries.
            </p>

            <p>
              I decided to build PerfectPath to help newer runners
              who may not know yet if they want to continue running,
              as well as average runners who want to improve their
              form and reduce their chance of injury without having
              to pay for it.
            </p>
          </article>
        )}

        {activeDmaic === 1 && (
          <article>
            <span className="pp-dmaic-phase">MEASURE</span>
            <h3>Finding what was worth measuring</h3>

            <p>
              I researched existing gait-analysis platforms and
              found that while some offered detailed feedback,
              they often required costly subscriptions. Others
              were more affordable but lacked meaningful analysis.
            </p>

            <p>
              Through multiple revisions, I built a platform that
              analyzes a runner's form from a short video and
              identifies common issues such as overstriding,
              excessive side sway, forward lean, and arm stiffness.
            </p>
          </article>
        )}

        {activeDmaic === 2 && (
          <article>
            <span className="pp-dmaic-phase">ANALYZE</span>
            <h3>Understanding the system's limitations</h3>

            <p>
              One recurring issue was that the YOLO analysis
              consumed too many resources for the free Render
              backend, so I tested different hosting platforms
              and video resolutions to find a setup that worked.
            </p>

            <p>
              I ran into a similar problem with video length.
              Originally, recordings could be over a minute long,
              but longer videos often caused the website to crash.
            </p>
          </article>
        )}

        {activeDmaic === 3 && (
          <article>
            <span className="pp-dmaic-phase">IMPROVE</span>
            <h3>Testing and redesigning</h3>

            <p>
              After testing different lengths and researching
              what YOLO needed for a useful analysis, I eventually
              limited recordings to 10 seconds.
            </p>

            <p>
              I used this approach to continuously test and
              redesign my backend based on what was simplest and
              most important to the website’s main purpose.
            </p>

            <p>
              I also added shoe recommendations based on each
              runner's results.
            </p>
          </article>
        )}

        {activeDmaic === 4 && (
          <article>
            <span className="pp-dmaic-phase">CONTROL</span>
            <h3>Using feedback to guide further development</h3>

            <p>
              Within five to six weeks after launching the website,
              more than 1,000 runners had used it.
            </p>

            <p>
              The growth felt almost ephemeral once I realized
              that most users stopped using the website after
              only three or four days. This showed me that I
              needed better ways to retain users.
            </p>

            <p>
              After reviewing their feedback, I decided to
              develop a mobile app with a built-in camera that
              automatically stops after a 10-second recording.
            </p>
          </article>
        )}
      </div>

      <footer className="pp-dmaic-footer">
        <p>
          I also learned that improvement does not always mean
          adding more; sometimes the best improvement is
          simplifying what already exists.
        </p>

<span>{activeDmaic + 1}/5</span>
      </footer>
    </section>
  </div>
)}


      

{screen === "home" && (
  <main className={`pp-home pp-home-${previewTerrain}`}>
    <div className="pp-home-overlay" />


    <header className="pp-header">
      <button className="pp-logo" onClick={goHome}>
        PERFECTPATH
      </button>

     
<nav
  className="pp-terrain-nav"
  aria-label="Choose running terrain"
  onMouseLeave={() => setPreviewTerrain("road")}
>
  <button
    onMouseEnter={() => setPreviewTerrain("road")}
    onFocus={() => setPreviewTerrain("road")}
    onClick={() => chooseRun("road")}
  >
    ROAD
  </button>

  <button
    onMouseEnter={() => setPreviewTerrain("flat")}
    onFocus={() => setPreviewTerrain("flat")}
    onClick={() => chooseRun("flat_trail")}
  >
    FLAT TRAIL
  </button>

  <button
    onMouseEnter={() => setPreviewTerrain("hill")}
    onFocus={() => setPreviewTerrain("hill")}
    onClick={() => chooseRun("trail_hill")}
  >
    HILL TRAIL
  </button>
</nav>


      <div className="pp-header-actions">
        <button onClick={() => setShowFounder(true)}>
          ABOUT
        </button>

        <button onClick={() => setShowProcess(true)}>
          PROCESS
        </button>

        <button onClick={user ? logout : loginWithGoogle}>
          {user ? "SIGN OUT" : "SIGN IN"}
        </button>
      </div>
    </header>

    <section className="pp-hero">
      <div className="pp-hero-content">
        <p className="pp-eyebrow">RUNNING FORM ANALYSIS</p>

        <h1>Perfect how you run.</h1>

        <p className="pp-description">
          Upload a video. Analyze your form.
          <br />
          Make changes.
        </p>

        <p className="pp-terrain-hint">
          SELECT A TERRAIN ABOVE TO BEGIN
          <span aria-hidden="true"> ↗</span>
        </p>
      </div>
    </section>

    <div className="pp-home-footer">
      <span>PERFECTPATH / RUNNING FORM ANALYSIS</span>
      <span>BUILT FOR RUNNERS BY A RUNNER </span>
    </div>
  </main>
)}



{screen === "analyze" && (
  <main className="analysis-page pp-lab-page">
    <button className="back-button" onClick={goHome}>
      ← BACK
    </button>

    <section className="pp-motion-layout">
      <div className="pp-motion-intro">
        <p className="pp-motion-terrain">
          {isHillTrail
            ? "HILL TRAIL / FORM ANALYSIS"
            : isFlatTrail
            ? "FLAT TRAIL / FORM ANALYSIS"
            : "ROAD / FORM ANALYSIS"}
        </p>

        <h1>
AIM          <br />
          <span>FOR PERFECTION</span>
        </h1>

        <p className="pp-motion-description">
          {isHillTrail
            ? "Fix your form while running on hills and uphill terrain"
            : isFlatTrail
            ? "Fix your form while running on trails"
            : "Fix your form while running on the road"}
        </p>

      </div>

      <div className="pp-motion-workspace">
        <div
          className={`pp-motion-stage ${dragActive ? "is-dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="pp-motion-crosshair" aria-hidden="true">
            <span />
            <span />
          </div>
{videoUrl && (
  <video
    ref={previewVideoRef}
    className="pp-motion-video-preview"
    src={videoUrl}
    controls
    playsInline
    preload="metadata"
    onTimeUpdate={(e) => setFrameTime(e.currentTarget.currentTime)}
  />
)}
          <div
  className={`pp-motion-stage-content ${
    videoUrl ? "pp-motion-content-with-video" : ""
  }`}
>
    

            <h2>
              {video ? "FOOTAGE READY." : "Add Running Footage Here"}
            </h2>

            <p>
              {video
                ? video.name
                : "Drop your running footage here or select a file."}
            </p>

            <input
              id="running-video-upload"
              className="hidden-file-input"
              type="file"
              accept="video/*,.mp4,.mov"
              onChange={(e) => handleVideoFile(e.target.files?.[0])}
            />

            <label
              className="pp-motion-select"
              htmlFor="running-video-upload"
            >
              {video ? "CHANGE FOOTAGE ↗" : "SELECT FOOTAGE ↗"}
            </label>
          </div>

          <div className="pp-motion-stage-bottom">
            <span>PERFECTPATH</span>
            <span>{dragActive ? "RELEASE TO UPLOAD" : "DRAG AND DROP ARE AVAILABLE"}</span>
          </div>
        </div>

        <div className="pp-motion-filmstrip">
          <div className="pp-motion-filmstrip-header">
            <span>FRAME SEQUENCE</span>
            <span>{video ? "PREVIEW PENDING" : "NO FOOTAGE LOADED"}</span>
          </div>

          
<div className="pp-motion-empty-frames">
  {videoFrames.length > 0 ? (
    videoFrames.map((frame, index) => (
      <button
        key={index}
        type="button"
        className={`pp-motion-frame-button ${
          Math.abs(frameTime - frame.time) <
          ((videoFrames[1]?.time - videoFrames[0]?.time) || 0.5) / 2
            ? "is-selected"
            : ""
        }`}
        onClick={() => seekToFrame(frame.time)}
        title={`Jump to ${frame.time.toFixed(1)} seconds`}
      >
        <img src={frame.image} alt={`Video frame ${index + 1}`} />
        <span>{frame.time.toFixed(1)}s</span>
      </button>
    ))
  ) : (
    Array.from({ length: 8 }, (_, index) => (
      <div key={index} className="pp-motion-empty-frame">
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
    ))
  )}
</div>

{video && videoFrames.length === 0 && (
  <p className="pp-motion-frame-status">
    {frameError
      ? "Frame previews unavailable for this video."
      : "Generating frame previews..."}
  </p>
)}

        </div>

        <div className="pp-motion-controls">
          <div className="pp-motion-requirements">
            <span>FULL BODY VISIBLE</span>
            <span>GOOD LIGHTING</span>
            <span>MP4 / MOV</span>
          </div>

          <div className="pp-motion-actions">
            {video && (
              <button
                className="pp-motion-remove"
                type="button"
                onClick={() => setVideo(null)}
              >
                REMOVE FILE
              </button>
            )}

            <button
              className="pp-motion-analyze"
              onClick={analyzeRun}
              disabled={!video || loading}
            >
              {loading ? "STARTING..." : "ANALYZE RUN ↗"}
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
)}


      {screen === "loading" && (
        <main className="loading-page">
          <div className="loading-card">



            <h2>Analyzing your run...</h2>
           <div className="loading-progress">
  {loadingSteps.map((step, index) => {
    const isComplete =
  loadingStep === loadingSteps.length || index < loadingStep;

const isActive =
  loadingStep !== loadingSteps.length && index === loadingStep;

    return (
      <div
        className={`loading-step ${
          isComplete ? "complete" : isActive ? "active" : ""
        }`}
        key={step}
      >
        <div className="loading-step-icon">
          {isComplete ? "✓" : isActive ? "↻" : ""}
        </div>

        <span>{step}</span>
      </div>
    );
  })}
</div>

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
<div className="pp-results-overview">
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

          <p className="issue-frequency">
  {typeof issue.frequency_percent === "number"
    ? `${issue.frequency_percent}%`
    : issue.frequency_percent ?? "N/A"}
</p>
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

  </div>
<div className="pp-results-bottom">
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
  <>
    <div className="shoe-recommendation-context">
      <p className="shoe-context-label">Recommendations based on</p>

      <div className="shoe-context-items">
        

        {result?.issues
          ?.filter((issue) => issue.detected)
          .slice(0, 2)
          .map((issue, index) => (
            <span key={index}>
              <Check size={16} />
              {issue.issue.replace("Possible ", "")}
            </span>
          ))}
      </div>
    </div>

    <div className="shoe-grid upgraded-shoe-grid">
      {shoeSuggestions.map((shoe, index) => {
        const tierInfo = getShoeTierInfo(shoe.tier, index);
        const TierIcon = tierInfo.icon;
        const features = getShoeFeatures(shoe);

        return (
          <article
            className={`shoe-result-card upgraded-shoe-card ${tierInfo.className}`}
            key={index}
          >
            <div className="shoe-card-header">
              <span className={`shoe-tier-badge ${tierInfo.className}`}>
                <TierIcon size={16} strokeWidth={2} />
                {tierInfo.label}
              </span>

              {tierInfo.className === "best-overall" && (
                <span className="recommended-label">Recommended</span>
              )}
            </div>

            <div className="shoe-name-block">
              <p className="shoe-brand">{shoe.brand}</p>
              <h3>{shoe.model}</h3>
              <span className="shoe-category">{shoe.category}</span>
            </div>

            <div className="shoe-divider" />

            <div className="shoe-features">
              <p className="shoe-features-title">Why it fits your run</p>

              {features.map((feature, featureIndex) => {
                const FeatureIcon = feature.icon;

                return (
                  <div className="shoe-feature-row" key={featureIndex}>
                    <span className="shoe-feature-icon">
                      <FeatureIcon size={17} strokeWidth={2} />
                    </span>
                    <span>{feature.text}</span>
                  </div>
                );
              })}
            </div>

            <div className="shoe-price-block">
              <span>Typical price</span>
              <strong>${shoe.price}</strong>
            </div>
          </article>
        );
      })}
    </div>
  </>
)}
    </section>
     </div>
  </main>
)}
    </div>
  );
}

export default App;