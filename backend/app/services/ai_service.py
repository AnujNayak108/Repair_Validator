from google import genai
from google.genai import types
from google.genai import errors as genai_errors
import json
import time
from ..core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Primary: gemini-1.5-flash (most stable on free tier)
# Fallbacks in order of preference
MODELS = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"]

def _generate_with_retry(prompt: str, max_retries: int = 5) -> str:
    """
    Call the Gemini API with automatic retries (exponential backoff) and
    model fallback when a 503 UNAVAILABLE or 429 rate-limit error is returned.
    """
    last_error = None
    for model in MODELS:
        for attempt in range(max_retries):
            try:
                print(f"[AI] Attempting model={model}, attempt={attempt + 1}")
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                print(f"[AI] Success with model={model}")
                return response.text
            except genai_errors.ServerError as e:
                last_error = e
                err_str = str(e)
                if "503" in err_str or "UNAVAILABLE" in err_str or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait = 2 ** (attempt + 1)  # 2s, 4s, 8s, 16s, 32s
                    print(f"[AI] Transient error from {model} (attempt {attempt + 1}/{max_retries}). Retrying in {wait}s... Error: {err_str[:80]}")
                    time.sleep(wait)
                    continue
                else:
                    print(f"[AI] Non-retriable server error from {model}: {err_str[:120]}")
                    break
            except Exception as e:
                last_error = e
                err_str = str(e)
                # Also catch client-side rate limit / quota errors
                if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                    wait = 2 ** (attempt + 1)
                    print(f"[AI] Rate limit from {model} (attempt {attempt + 1}/{max_retries}). Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                print(f"[AI] Unexpected error from {model}: {err_str[:120]}")
                break
        else:
            # All retries exhausted for this model — try the next model
            print(f"[AI] All {max_retries} retries exhausted for {model}. Trying next model...")
            continue
        # Non-retriable error on this model — try next model immediately
        continue

    raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")


def parse_estimate_text(raw_text: str) -> dict:
    """
    Uses Gemini to extract structured line items from raw estimate text.
    """
    prompt = f"""
    You are an expert collision repair estimator. Given the raw OCR text from a collision repair estimate, extract all valid repair line items. Ignore boilerplate text, headers, and footers.
    Return ONLY a valid JSON object following this schema:
    {{
      "total_amount": number (or null if not found),
      "vehicle_year": number (or null if not found),
      "vehicle_make": string (or null if not found),
      "vehicle_model": string (or null if not found),
      "line_items": [
        {{
          "part_name": string,
          "part_number": string (or null),
          "quantity": number,
          "labor_hours": number,
          "unit_price": number,
          "operation_type": string (e.g., "Repair", "Replace", "Paint")
        }}
      ]
    }}
    
    Raw text:
    {raw_text}
    """
    
    text = _generate_with_retry(prompt)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"[AI] Failed to decode JSON from parse response:\n{text[:500]}")
        return {}


def validate_estimate(line_items: list, impact_zone: str) -> list:
    """
    Uses Gemini to identify duplicates and unrelated items.
    """
    prompt = f"""
    Analyze the following list of repair line items for a vehicle with damage isolated exclusively to the: "{impact_zone}".
    Identify any items that:
    1. Seem physically unrelated to the impact area.
    2. Appear to be duplicate charges or overlapping labor operations.
    
    Explain your reasoning clearly and professionally. Do not sound accusatory.
    Return ONLY a valid JSON object following this schema:
    {{
      "flagged_items": [
        {{
          "line_item_index": int (the 0-based index of the item in the provided array),
          "issue_type": "Unrelated" | "Duplicate" | "Inflated",
          "reason": string (clear, non-accusatory explanation),
          "confidence": int (1-100),
          "severity": "Low" | "Medium" | "High"
        }}
      ]
    }}
    
    Line Items:
    {json.dumps(line_items)}
    """
    
    text = _generate_with_retry(prompt)
    try:
        data = json.loads(text)
        return data.get("flagged_items", [])
    except json.JSONDecodeError:
        print(f"[AI] Failed to decode JSON from validation response:\n{text[:500]}")
        return []
