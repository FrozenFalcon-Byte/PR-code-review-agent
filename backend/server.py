from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Optional
import uuid
import asyncio
import traceback
import queue
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
import agent
from tools import ReviewOutput, ConflictReport

load_dotenv()

app = FastAPI(
    title="PR Code Review Agent",
    description="Autonomous code review agent powered by Claude. Fetches a GitHub PR, "
                "iteratively gathers context, and returns a structured review covering "
                "bugs, security issues, and suggestions.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=4)

# In-memory job store for async reviews
jobs: dict[str, dict] = {}


class ReviewRequest(BaseModel):
    pr_url: str
    max_iterations: Optional[int] = 10

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "pr_url": "https://github.com/pallets/flask/pull/5557",
                    "max_iterations": 10,
                }
            ]
        }
    }


ReviewResponse = ReviewOutput


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending | running | done | error
    result: Optional[ReviewResponse] = None
    error: Optional[str] = None


@app.post(
    "/review",
    response_model=ReviewResponse,
    summary="Run a synchronous PR review",
    description="Runs the agent synchronously and returns the review when complete. "
                "May take 30–120 seconds depending on PR size and iteration count.",
)
def review_sync(req: ReviewRequest):
    try:
        result = agent.run(req.pr_url, max_iterations=req.max_iterations)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")


class ReviewWithPromptResponse(BaseModel):
    review: ReviewResponse
    agent_prompt: str


@app.post(
    "/review/with-prompt",
    response_model=ReviewWithPromptResponse,
    summary="Review PR and generate a copy-pasteable AI agent prompt",
    description=(
        "Runs the full code review, then generates a self-contained prompt you can paste into "
        "ChatGPT, Claude, Gemini, or any AI assistant to get specific fix suggestions for each finding."
    ),
)
def review_with_prompt(req: ReviewRequest):
    try:
        review = agent.run(req.pr_url, max_iterations=req.max_iterations)
        prompt = agent.generate_prompt(req.pr_url, review)
        return {"review": review, "agent_prompt": prompt}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")


@app.post(
    "/review/async",
    response_model=JobStatus,
    status_code=202,
    summary="Start an async PR review job",
    description="Queues the review and returns a job_id immediately. "
                "Poll GET /review/status/{job_id} to check progress.",
)
def review_async(req: ReviewRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "result": None, "error": None}

    def run_job():
        jobs[job_id]["status"] = "running"
        try:
            result = agent.run(req.pr_url, max_iterations=req.max_iterations)
            jobs[job_id]["status"] = "done"
            jobs[job_id]["result"] = result
        except Exception as e:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = str(e)

    background_tasks.add_task(run_job)
    return {"job_id": job_id, "status": "pending"}


@app.get(
    "/review/status/{job_id}",
    response_model=JobStatus,
    summary="Poll async review job status",
    description="Returns the current status and result (when done) for an async review job.",
)
def review_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "status": job["status"],
        "result": job["result"],
        "error": job["error"],
    }


class FullReviewResponse(BaseModel):
    review: ReviewResponse
    conflicts: ConflictReport
    agent_prompt: str


@app.post(
    "/review/full",
    response_model=FullReviewResponse,
    summary="Full PR analysis — review + conflict analysis + AI prompt",
    description=(
        "Runs all three analyses in sequence:\n"
        "1. **Code review** — bugs, security issues, suggestions\n"
        "2. **Conflict analysis** — merge conflict explanation and resolution advice\n"
        "3. **AI prompt** — copy-pasteable prompt with all findings for any AI assistant\n\n"
        "Use the individual endpoints (`/review`, `/review/conflicts`, `/review/with-prompt`) "
        "for targeted testing or when you only need one result."
    ),
)
def review_full(req: ReviewRequest):
    try:
        # run() and analyze_conflicts() are independent — fire them in parallel
        with ThreadPoolExecutor(max_workers=2) as pool:
            review_future = pool.submit(agent.run, req.pr_url, req.max_iterations)
            conflicts_future = pool.submit(agent.analyze_conflicts, req.pr_url)
            review = review_future.result()
            conflicts = conflicts_future.result()

        # generate_prompt() needs the review result, so runs after
        prompt = agent.generate_prompt(req.pr_url, review)
        return {"review": review, "conflicts": conflicts, "agent_prompt": prompt}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")


@app.post(
    "/review/conflicts",
    response_model=ConflictReport,
    summary="Analyze merge conflicts in a PR",
    description=(
        "Fetches both sides of every changed file in the PR, then uses the LLM to explain "
        "what each side is doing, why they conflict, and how to resolve each conflict. "
        "Returns a structured report with per-file resolution advice and an overall strategy."
    ),
)
def review_conflicts(req: ReviewRequest):
    try:
        result = agent.analyze_conflicts(req.pr_url)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")


class GenerateCodeRequest(BaseModel):
    prompt: str


@app.post(
    "/review/generate-code",
    summary="Stream LLM code fixes for a PR",
    description=(
        "Accepts the agent prompt (full diff + findings) and streams back code fixes "
        "as Server-Sent Events. Each 'chunk' event carries a text delta; "
        "'done' signals completion."
    ),
)
def generate_code(req: GenerateCodeRequest):
    def event_generator():
        try:
            for chunk in agent.generate_code_stream(req.prompt):
                yield f"event: chunk\ndata: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps(str(e))}\n\n"
        finally:
            yield f"event: done\ndata: null\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health", summary="Health check")
def health():
    return {"status": "ok"}


@app.post(
    "/review/stream",
    summary="Stream PR analysis logs and result",
    description="Streams log lines via Server-Sent Events (SSE). The final event 'result' contains the JSON payload.",
)
def review_stream(req: ReviewRequest):
    q = queue.Queue()

    def log_cb(msg: str):
        q.put({"type": "log", "data": msg})

    def run_job():
        try:
            # run() and analyze_conflicts() in parallel — same as /review/full
            with ThreadPoolExecutor(max_workers=2) as pool:
                review_future = pool.submit(agent.run, req.pr_url, req.max_iterations, log_cb)
                conflicts_future = pool.submit(agent.analyze_conflicts, req.pr_url, log_cb)
                review = review_future.result()
                conflicts = conflicts_future.result()
            prompt = agent.generate_prompt(req.pr_url, review, log_cb)
            result = {"review": review, "conflicts": conflicts, "agent_prompt": prompt}
            q.put({"type": "result", "data": result})
        except Exception as e:
            q.put({"type": "error", "data": str(e)})
        finally:
            q.put({"type": "done", "data": None})

    threading.Thread(target=run_job).start()

    def event_generator():
        while True:
            item = q.get()
            t = item["type"]
            data = item["data"]
            
            if t == "done":
                break
            elif t == "log":
                yield f"event: log\ndata: {json.dumps(data)}\n\n"
            elif t == "result":
                yield f"event: result\ndata: {json.dumps(data)}\n\n"
            elif t == "error":
                yield f"event: error\ndata: {json.dumps(data)}\n\n"
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
