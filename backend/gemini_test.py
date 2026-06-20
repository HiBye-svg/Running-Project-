import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ["GEMINI_API_KEY"]

genai.configure(api_key=api_key)

model = genai.GenerativeModel("gemini-2.5-flash")

response = model.generate_content(
    "Explain overstriding in running in two sentences."
)

print(response.text)