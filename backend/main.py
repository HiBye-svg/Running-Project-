import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil

from analyzer import analyze_run
from shoe_recommender import get_shoe_recommendations

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://perfectpath.app",
        "https://www.perfectpath.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class ShoeRequest(BaseModel):
    foot_width: str
    issues: list
    run_type: str = "road"  # road, flat_trail, trail_hill
    feedback: str


@app.get("/")
def home():
    return {"message": "Backend is running"}


@app.post("/analyze")
async def analyze_video(
    file: UploadFile = File(...),
    run_type: str = Form("road")
):
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_run(file_path, run_type)
    return result


@app.post("/shoes")
def recommend_shoes(request: ShoeRequest):
    shoes = get_shoe_recommendations(
        request.foot_width,
        request.issues,
        request.run_type,
        request.feedback
    )
    return {"shoes": shoes}


@app.get("/history")
def get_history():
    history_file = "run_history.json"

    if not os.path.exists(history_file):
        return {"history": []}

    with open(history_file, "r") as file:
        history = json.load(file)

    return {"history": history}


@app.delete("/history")
def clear_history():
    history_file = "run_history.json"

    with open(history_file, "w") as file:
        json.dump([], file)

    return {"message": "History cleared"}