# Collision Repair Estimate Validator

An AI-powered system designed to analyze collision repair estimates and automatically detect anomalies such as duplicate line items, unrelated repairs, and suspicious replacements. This project was built to bring transparency and customer explainability to the auto repair process.

## What It Does

When an auto collision repair estimate (PDF) is generated, it often contains complex automotive terminology, labor hour calculations, and part replacements. This system automatically audits that estimate by cross-referencing the claimed repairs against the actual physical impact zone.

The system specifically looks for:
*   **Duplicate Line Items:** E.g., charging for a "Front Bumper Bracket" and a "Bumper Mounting Bracket" simultaneously.
*   **Unrelated Repairs:** Flagging a "Left Tail Light Assembly" replacement when the impact was recorded as "Front Right".
*   **Suspicious Labor/Replacements:** Highlighting repairs that might normally be repairable instead of fully replaced, or parts that are grouped inconsistently.

## How It Works

This application is built with a modern, modular architecture:

1.  **Frontend (React + Vite + Tailwind CSS)**:
    *   Provides a sleek, premium drag-and-drop interface for users to upload their PDF estimates and select the primary **Impact Zone** of the vehicle.
    *   Once uploaded, the frontend actively polls the backend until the analysis is complete, then displays an interactive dashboard summarizing the total cost and color-coding any flagged anomalies with clear, human-readable explanations.

2.  **Backend (Python + FastAPI + SQLite)**:
    *   Handles the asynchronous processing of the uploaded PDFs.
    *   Stores estimate metadata, extracted line items, and flagged anomalies in a local SQLite database using SQLAlchemy.

3.  **AI & OCR Pipeline (Gemini 1.5 Pro)**:
    *   **Extraction:** The backend uses `pdfplumber` to extract raw text from the PDF. The unstructured text is sent to the Gemini API, which acts as an expert collision estimator to extract structured JSON data (Part Name, Labor Hours, Unit Price, etc.).
    *   **Validation:** A secondary AI pass evaluates the structured line items against the provided Impact Zone. It applies semantic reasoning to determine if any parts are physically unrelated to the damage area or if there are overlapping labor operations. It generates a clear, non-accusatory explanation for why an item was flagged.

## Getting Started

### Prerequisites
*   Node.js (v18+)
*   Python (3.11+)
*   A Gemini API Key from Google AI Studio.

### Backend Setup
1. Navigate to the `backend` directory.
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/Scripts/activate # Windows
   pip install -r requirements.txt
   ```
3. Add your Gemini API key to `backend/.env`:
   ```env
   MISTRAL_API_KEY=your_api_key_here
   DATABASE_URL=sqlite:///./sql_app.db
   ```
4. Run the FastAPI server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.
