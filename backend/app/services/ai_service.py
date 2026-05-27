from mistralai.client import Mistral
import json
import time
from ..core.config import settings

client = Mistral(api_key=settings.MISTRAL_API_KEY)

# Primary model first, then fallbacks
MODELS = ["mistral-large-latest", "mistral-small-latest", "open-mistral-7b"]


def _generate_with_retry(prompt: str, max_retries: int = 5) -> str:
    """
    Call the Mistral API with automatic retries (exponential backoff) and
    model fallback when a 503/429 or rate-limit error is returned.
    """
    last_error = None
    for model in MODELS:
        for attempt in range(max_retries):
            try:
                print(f"[AI] Attempting model={model}, attempt={attempt + 1}")
                response = client.chat.complete(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                )
                text = response.choices[0].message.content
                print(f"[AI] Success with model={model}")
                return text
            except Exception as e:
                last_error = e
                err_str = str(e)
                # Retriable: rate-limit or service unavailable
                if any(kw in err_str for kw in ["429", "503", "rate", "quota", "unavailable"]):
                    wait = 2 ** (attempt + 1)  # 2s, 4s, 8s, 16s, 32s
                    print(
                        f"[AI] Transient error from {model} "
                        f"(attempt {attempt + 1}/{max_retries}). "
                        f"Retrying in {wait}s... Error: {err_str[:80]}"
                    )
                    time.sleep(wait)
                    continue
                # Non-retriable error — try next model
                print(f"[AI] Non-retriable error from {model}: {err_str[:120]}")
                break
        else:
            # All retries exhausted for this model
            print(f"[AI] All {max_retries} retries exhausted for {model}. Trying next model...")
            continue
        continue

    raise RuntimeError(f"All Mistral models failed. Last error: {last_error}")


def parse_estimate_text(raw_text: str) -> dict:
    """
    Uses Mistral to extract structured line items from raw estimate text.
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
    Uses Mistral to identify duplicates and unrelated items.
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
