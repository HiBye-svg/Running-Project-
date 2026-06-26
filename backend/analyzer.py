import cv2
import math
import os
import json
from datetime import datetime

import google.generativeai as genai
from dotenv import load_dotenv
from ultralytics import YOLO
yolo_model = YOLO("yolo11n-pose.pt")

load_dotenv("../.env")

api_key = os.environ["GEMINI_API_KEY"]
genai.configure(api_key=api_key)

gemini_model = genai.GenerativeModel("gemini-2.5-flash")

history_file = "run_history.json"


def distance(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def angle(a, b, c):
    ba = (a[0] - b[0], a[1] - b[1])
    bc = (c[0] - b[0], c[1] - b[1])

    dot = ba[0] * bc[0] + ba[1] * bc[1]
    mag_ba = math.sqrt(ba[0] ** 2 + ba[1] ** 2)
    mag_bc = math.sqrt(bc[0] ** 2 + bc[1] ** 2)

    if mag_ba == 0 or mag_bc == 0:
        return 0

    cosine = dot / (mag_ba * mag_bc)
    cosine = max(-1, min(1, cosine))
    return math.degrees(math.acos(cosine))


def format_time(seconds):
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d}"


def merge_times_into_ranges(times, gap_allowed=1.0):
    if not times:
        return []

    times = sorted(times)
    ranges = []

    start = times[0]
    end = times[0]

    for t in times[1:]:
        if t - end <= gap_allowed:
            end = t
        else:
            ranges.append((start, end))
            start = t
            end = t

    ranges.append((start, end))
    return ranges


def format_ranges(times):
    ranges = merge_times_into_ranges(times)
    formatted = []

    for start, end in ranges:
        if abs(start - end) < 0.5:
            formatted.append(format_time(start))
        else:
            formatted.append(f"{format_time(start)}–{format_time(end)}")

    return formatted


def load_history():
    if not os.path.exists(history_file):
        return []

    with open(history_file, "r") as file:
        return json.load(file)


def save_history(history):
    with open(history_file, "w") as file:
        json.dump(history, file, indent=4)


def build_gemini_feedback(current_run, previous_run):
    prompt = f"""
You are a running form assistant.

Write 45-60 words total.

Tone: helpful, direct, not robotic.

Structure:
1 short progress sentence.
2 practical fixes.

Rules:
- No JSON.
- No markdown.
- No medical claims.
- Mention improvement/regression only if obvious.
- Focus on the most important detected issue.
- If run_type is flat_trail, remember trail terrain naturally has more uneven movement.
- If run_type is trail_hill, remember uphill running naturally has more forward lean and terrain variation.

Previous run:
{previous_run}

Current run:
{current_run}
"""

    response = gemini_model.generate_content(prompt)
    return response.text


def get_thresholds(run_type):
    if run_type == "trail_hill":
        return {
            "overstride_limit": 0.65,
            "lean_limit": 0.45,
            "elbow_limit": 170,
            "sway_limit": 0.18,
            "overstride_min_percent": 25,
            "lean_min_percent": 35,
            "elbow_min_percent": 25,
        }

    if run_type == "flat_trail":
        return {
            "overstride_limit": 0.55,
            "lean_limit": 0.35,
            "elbow_limit": 168,
            "sway_limit": 0.16,
            "overstride_min_percent": 22,
            "lean_min_percent": 28,
            "elbow_min_percent": 22,
        }

    return {
        "overstride_limit": 0.50,
        "lean_limit": 0.30,
        "elbow_limit": 165,
        "sway_limit": 0.12,
        "overstride_min_percent": 20,
        "lean_min_percent": 20,
        "elbow_min_percent": 20,
    }


def build_current_run(
    video_path,
    run_type,
    analyzed_frames,
    overstride_times,
    forward_lean_times,
    stiff_elbows_times,
    side_sway_detected,
    build_issue,
):
    if run_type == "trail_hill":
        issues = [
            build_issue("Hill Overstride", overstride_times, min_percent=25),
            build_issue("Excessive Hill Forward Lean", forward_lean_times, min_percent=35),
            build_issue("Stiff Arm Drive", stiff_elbows_times, min_percent=25),
            {
                "issue": "Trail Side-to-Side Sway",
                "detected": side_sway_detected,
                "frequency_percent": "full-video pattern" if side_sway_detected else 0,
                "time_ranges": ["full video"] if side_sway_detected else [],
            },
        ]

    elif run_type == "flat_trail":
        issues = [
            build_issue("Trail Overstride", overstride_times, min_percent=22),
            build_issue("Trail Forward Lean", forward_lean_times, min_percent=28),
            build_issue("Trail Arm Stiffness", stiff_elbows_times, min_percent=22),
            {
                "issue": "Trail Side-to-Side Sway",
                "detected": side_sway_detected,
                "frequency_percent": "full-video pattern" if side_sway_detected else 0,
                "time_ranges": ["full video"] if side_sway_detected else [],
            },
        ]

    else:
        issues = [
            build_issue("Overstride", overstride_times, min_percent=20),
            build_issue("Forward Lean", forward_lean_times, min_percent=20),
            build_issue("Stiff Elbows", stiff_elbows_times, min_percent=20),
            {
                "issue": "Side-to-Side Sway",
                "detected": side_sway_detected,
                "frequency_percent": "full-video pattern" if side_sway_detected else 0,
                "time_ranges": ["full video"] if side_sway_detected else [],
            },
        ]

    return {
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "video": os.path.basename(video_path),
        "run_type": run_type,
        "analyzed_frames": analyzed_frames,
        "issues": issues,
    }


def analyze_run(video_path, run_type="road"):
    thresholds = get_thresholds(run_type)

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)

    overstride_times = []
    forward_lean_times = []
    stiff_elbows_times = []
    hip_center_x_values = []

    analyzed_frames = 0
    frame_number = 0

    def issue_percentage(times):
        if analyzed_frames == 0:
            return 0
        return (len(times) / analyzed_frames) * 100

    def build_issue(issue_name, times, min_percent=20):
        percent = round(issue_percentage(times), 1)

        return {
            "issue": issue_name,
            "detected": percent >= min_percent,
            "frequency_percent": percent,
            "time_ranges": format_ranges(times) if percent >= min_percent else [],
        }

    while cap.isOpened():
        success, frame = cap.read()

        if not success:
            break

        frame_number += 1

        # Only analyze every 5th frame to reduce memory/CPU use
        if frame_number % 8 != 0:
            continue

        timestamp = 0 if fps == 0 else frame_number / fps

        # Resize frame before running YOLO to reduce memory use
        frame = cv2.resize(frame, (640, 360))

        results = yolo_model(frame)
        result = results[0]

        if result.keypoints is not None and len(result.keypoints.xy) > 0:
            analyzed_frames += 1
            person = result.keypoints.xy[0]

            left_shoulder = person[5]
            right_shoulder = person[6]
            left_elbow = person[7]
            right_elbow = person[8]
            left_wrist = person[9]
            right_wrist = person[10]
            left_hip = person[11]
            right_hip = person[12]
            left_ankle = person[15]
            right_ankle = person[16]

            hip_center_x = (left_hip[0] + right_hip[0]) / 2
            shoulder_center_x = (left_shoulder[0] + right_shoulder[0]) / 2

            left_leg_length = distance(left_hip, left_ankle)
            right_leg_length = distance(right_hip, right_ankle)
            avg_leg_length = (left_leg_length + right_leg_length) / 2

            hip_center_x_values.append(float(hip_center_x))

            if avg_leg_length > 0:
                left_overstride_ratio = abs(left_ankle[0] - hip_center_x) / avg_leg_length
                right_overstride_ratio = abs(right_ankle[0] - hip_center_x) / avg_leg_length

                if (
                    left_overstride_ratio > thresholds["overstride_limit"]
                    or right_overstride_ratio > thresholds["overstride_limit"]
                ):
                    overstride_times.append(timestamp)

                torso_lean_ratio = abs(shoulder_center_x - hip_center_x) / avg_leg_length

                if torso_lean_ratio > thresholds["lean_limit"]:
                    forward_lean_times.append(timestamp)

                left_elbow_angle = angle(left_shoulder, left_elbow, left_wrist)
                right_elbow_angle = angle(right_shoulder, right_elbow, right_wrist)

                if (
                    left_elbow_angle > thresholds["elbow_limit"]
                    or right_elbow_angle > thresholds["elbow_limit"]
                ):
                    stiff_elbows_times.append(timestamp)

    cap.release()

    side_sway_detected = False

    if len(hip_center_x_values) > 10:
        avg_hip_x = sum(hip_center_x_values) / len(hip_center_x_values)
        hip_sway = max(abs(x - avg_hip_x) for x in hip_center_x_values)

        if avg_hip_x > 0 and (hip_sway / avg_hip_x) > thresholds["sway_limit"]:
            side_sway_detected = True

    current_run = build_current_run(
        video_path=video_path,
        run_type=run_type,
        analyzed_frames=analyzed_frames,
        overstride_times=overstride_times,
        forward_lean_times=forward_lean_times,
        stiff_elbows_times=stiff_elbows_times,
        side_sway_detected=side_sway_detected,
        build_issue=build_issue,
    )

    history = load_history()
    previous_run = history[-1] if history else None

    history.append(current_run)
    save_history(history)

    feedback = build_gemini_feedback(current_run, previous_run)

    return {
        "message": "Video analyzed successfully",
        "filename": os.path.basename(video_path),
        "run_type": run_type,
        "issues": current_run["issues"],
        "previous_run": previous_run,
        "feedback": feedback,
    }