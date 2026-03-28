import os
from google import genai

FULL_CONTEXT_THRESHOLD = 200_000  # tokens
CHARS_PER_TOKEN = 4


def estimate_tokens(text: str) -> int:
    """
    Estimates or counts tokens. 
    Production Rigor: Uses the Gemini SDK for precision if an API key is available.
    """
    try:
        client = genai.Client(api_key=os.environ["GOOGLE_GENERATIVE_AI_API_KEY"])
        response = client.models.count_tokens(
            model="gemini-2.5-flash",
            contents=text
        )
        return response.total_tokens
    except Exception:
        # Fallback to heuristic if API call fails or offline
        return len(text) // CHARS_PER_TOKEN
