import asyncio
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from services.rag_engine import create_chat_stream
from services.google_drive import validate_access_token
from models import ChatRequest
from google.genai.errors import ClientError
from services.limiter import limiter

router = APIRouter()


@router.post("")
@limiter.limit("10/minute")
async def chat(request: Request, body: ChatRequest, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    # Run synchronous token validation in a thread pool to avoid blocking the event loop
    is_valid = await asyncio.get_event_loop().run_in_executor(None, validate_access_token, token)
    if not token or not is_valid:
        raise HTTPException(status_code=401, detail="Invalid or expired Google access token")

    context_keys = body.folderIds

    def generate():
        try:
            for chunk in create_chat_stream(context_keys, body.messages, body.query):
                yield chunk
        except ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                yield "Error: Gemini API rate limit exceeded. Please wait a minute and try again."
            else:
                yield f"Error from AI Provider: {str(e)}"
        except ValueError as e:
            if "CONTEXT_NOT_FOUND" in str(e):
                yield "Error: Folder context not found. Please re-ingest the folder."
            else:
                yield f"Error: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")
