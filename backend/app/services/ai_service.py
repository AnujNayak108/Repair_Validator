import google.generativeai as genai
import json
from ..core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-pro-latest')

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
    
    response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
    try:
        data = json.loads(response.text)
        return data
    except json.JSONDecodeError:
        print("Failed to decode JSON from Gemini response.")
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
    
    response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
    try:
        data = json.loads(response.text)
        return data.get("flagged_items", [])
    except json.JSONDecodeError:
        print("Failed to decode JSON from Gemini validation response.")
        return []
