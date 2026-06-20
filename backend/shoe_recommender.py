import json
import google.generativeai as genai
from shoe_database import SHOE_DATABASE


def get_shoe_recommendations(foot_width, issues, run_type="road"):
    detected = [i["issue"].replace("Possible ", "") for i in issues if i["detected"]]

    width_map = {
        "regular": "R",
        "wide": "W",
        "extra wide": "EW",
        "narrow": "R",
    }

    width_code = width_map.get(foot_width.lower(), "R")

    if run_type == "trail_hill":
        target_category = "Trail"
    elif any("side-to-side" in issue.lower() for issue in detected):
        target_category = "Stability"
    elif any("overstride" in issue.lower() for issue in detected):
        target_category = "Neutral"
    else:
        target_category = "Neutral"

    candidates = [
        shoe for shoe in SHOE_DATABASE
        if width_code in shoe["widths"] and shoe["category"] == target_category
    ]

    if len(candidates) < 6:
        candidates = [
            shoe for shoe in SHOE_DATABASE
            if shoe["category"] == target_category
        ]

    if len(candidates) < 3:
        candidates = SHOE_DATABASE

    candidates = sorted(candidates, key=lambda shoe: shoe["price"])
    candidates = candidates[:20]

    prompt = f"""
You are a running shoe recommender.

Pick exactly 3 shoes from this candidate list:
1 cheapest/budget option
1 best-value option
1 premium option

Rules:
- Only choose shoes from the candidate list.
- Do not invent shoes.
- Return ONLY valid JSON.
- No markdown.
- Reasons must be short.
- If this is a trail/hill run, prioritize trail shoes.

User foot width: {foot_width}
Run type: {run_type}
Detected running issues: {detected}

Candidate shoes:
{json.dumps(candidates, indent=2)}

Return format:
{{
  "shoes": [
    {{
      "tier": "Cheap",
      "brand": "...",
      "model": "...",
      "price": 120,
      "category": "...",
      "widths": ["R"],
      "reason": "short reason"
    }},
    {{
      "tier": "Affordable",
      "brand": "...",
      "model": "...",
      "price": 150,
      "category": "...",
      "widths": ["R"],
      "reason": "short reason"
    }},
    {{
      "tier": "Premium",
      "brand": "...",
      "model": "...",
      "price": 200,
      "category": "...",
      "widths": ["R"],
      "reason": "short reason"
    }}
  ]
}}
"""

    response = genai.GenerativeModel("gemini-2.5-flash").generate_content(prompt)

    text = response.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    return json.loads(text)["shoes"]