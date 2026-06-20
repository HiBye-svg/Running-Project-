import cv2
import math
import os
import json
from datetime import datetime

import google.generativeai as genai
from dotenv import load_dotenv
from ultralytics import YOLO

load_dotenv("../.env")

api_key = os.environ["GEMINI_API_KEY"]
genai.configure(api_key=api_key)

gemini_model = genai.GenerativeModel("gemini-2.5-flash")
yolo_model = YOLO("yolo11n-pose.pt")

video_path = r"C:\Users\hrudh\Downloads\IMG_1653.MOV"
history_file = "run_history.json"

cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)

overstride_times = []
forward_lean_times = []
stiff_elbows_times = []
hip_center_x_values = []

analyzed_frames = 0
frame_number = 0


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
You are a running form assistant, not a doctor.

A computer vision system analyzed a runner's form.
Explain the current findings in beginner-friendly language.

Rules:
- Do not make medical claims.
- Do not say the runner will get injured.
- Use cautious language like "possible pattern" and "may help."
- Mention improvement or regression compared to the previous run if useful.
- Give practical form cues and drills.

Previous run:
{previous_run}

Current run:
{current_run}
"""

    response = gemini_model.generate_content(prompt)
    return response.text


while cap.isOpened():
    success, frame = cap.read()

    if not success:
        break

    frame_number += 1
    timestamp = frame_number / fps

    results = yolo_model(frame)
    result = results[0]
    annotated_frame = result.plot()

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

            overstride_limit = 0.50

            if left_overstride_ratio > overstride_limit or right_overstride_ratio > overstride_limit:
                overstride_times.append(timestamp)

            torso_lean_ratio = abs(shoulder_center_x - hip_center_x) / avg_leg_length

            lean_limit = 0.30

            if torso_lean_ratio > lean_limit:
                forward_lean_times.append(timestamp)

            left_elbow_angle = angle(left_shoulder, left_elbow, left_wrist)
            right_elbow_angle = angle(right_shoulder, right_elbow, right_wrist)

            if left_elbow_angle > 165 or right_elbow_angle > 165:
                stiff_elbows_times.append(timestamp)

    screen_width = 900
    height, width = annotated_frame.shape[:2]
    scale = screen_width / width
    new_height = int(height * scale)

    display_frame = cv2.resize(annotated_frame, (screen_width, new_height))
    cv2.imshow("Running Form Helper", display_frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()

side_sway_detected = False

if len(hip_center_x_values) > 10:
    avg_hip_x = sum(hip_center_x_values) / len(hip_center_x_values)
    hip_sway = max(abs(x - avg_hip_x) for x in hip_center_x_values)

    if avg_hip_x > 0 and (hip_sway / avg_hip_x) > 0.12:
        side_sway_detected = True

current_run = {
    "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "video": "IMG_1653.MOV",
    "analyzed_frames": analyzed_frames,
    "issues": [
        build_issue("Possible overstride", overstride_times),
        build_issue("Possible forward lean", forward_lean_times),
        build_issue("Possible stiff elbows", stiff_elbows_times),
        {
            "issue": "Possible excessive side-to-side sway",
            "detected": side_sway_detected,
            "frequency_percent": "full-video pattern" if side_sway_detected else 0,
            "time_ranges": ["full video"] if side_sway_detected else [],
        },
    ],
}

history = load_history()
previous_run = history[-1] if history else None

history.append(current_run)
save_history(history)

print("\nFinal Structured Report")
print("-----------------------")
print(json.dumps(current_run, indent=4))

print("\nPrevious Run")
print("------------")
print(json.dumps(previous_run, indent=4) if previous_run else "No previous run found.")

print("\nGemini Feedback")
print("---------------")
feedback = build_gemini_feedback(current_run, previous_run)
print(feedback)