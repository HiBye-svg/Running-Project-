import json
import google.generativeai as genai
from shoe_database import SHOE_DATABASE


def get_shoe_recommendations(
    foot_width,
    issues,
    run_type="road",
    feedback=""
):
    detected = [i["issue"].replace("Possible ", "") for i in issues if i["detected"]]

    width_map = {
        "regular": "R",
        "wide": "W",
        "extra wide": "EW",
        "narrow": "R",
    }

    width_code = width_map.get(foot_width.lower(), "R")

    # 1. Filter by run type first
    if run_type in ["flat_trail", "trail_hill"]:
        allowed_categories = ["Trail"]
    else:
        allowed_categories = ["Neutral", "Stability", "Race", "Race/Tempo"]

    candidates = [
        shoe for shoe in SHOE_DATABASE
        if shoe["category"] in allowed_categories and width_code in shoe["widths"]
    ]

    # 2. If width filtering is too strict, keep run type filter but relax width
    if len(candidates) < 6:
        candidates = [
            shoe for shoe in SHOE_DATABASE
            if shoe["category"] in allowed_categories
        ]

    # 3. Emergency fallback
    if len(candidates) < 3:
        candidates = SHOE_DATABASE

    candidates = sorted(candidates, key=lambda shoe: shoe["price"])
    candidates = candidates[:25]

    prompt = f"""
You are a running shoe recommender for Perfect Path.

Pick exactly 3 shoes from the candidate list.

Rules:
- Only choose shoes from the candidate list.
- Do not invent shoes.
- Return ONLY valid JSON.
- No markdown.
- Reasons must be short and specific.
- For flat_trail or trail_hill, choose only trail shoes.
- For road, do not choose trail shoes.
- Use the detected running issues when deciding.
- If side-to-side sway is detected, prefer stability/supportive options.
- If overstride is detected, prefer daily trainers with reliable cushioning.
- If forward lean is detected, prefer stable, protective shoes.
- If stiff elbows is detected, do not over-focus on shoes because that is mostly form-related.

User foot width: {foot_width}
Width code: {width_code}
Run type: {run_type}
Detected running issues: {detected}
AI Running Analysis:
{feedback}

Candidate shoes:
{json.dumps(candidates, indent=2)}

Return format:
{{
  "shoes": [
    {{
      "tier": "Budget",
      "brand": "...",
      "model": "...",
      "price": 120,
      "category": "...",
      "widths": ["R"],
      "reason": "short reason"
    }},
    {{
      "tier": "Best Value",
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

    try:
        return json.loads(text)["shoes"]
    except Exception:
        # fallback if Gemini returns broken JSON
        return candidates[:3]