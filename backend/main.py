import os
import uuid
import json
import asyncio
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import zipfile

app = FastAPI(title="FaceSwap Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        self.active_connections[job_id] = websocket

    def disconnect(self, job_id: str):
        if job_id in self.active_connections:
            del self.active_connections[job_id]

    async def send_personal_message(self, message: dict, job_id: str):
        if job_id in self.active_connections:
            await self.active_connections[job_id].send_json(message)

manager = ConnectionManager()

import cv2
import numpy as np
from pipeline.face_swap import swap_face
from pipeline.restoration import restore_face
from pipeline.color_match import match_skin_tone
from pipeline.blending import create_soft_mask, seamless_blend, apply_unsharp_mask

# Actual background task for pipeline processing
async def process_swap_job(job_id: str, source_path: str, target_paths: List[str], settings: dict):
    total_targets = len(target_paths)
    
    try:
        source_img = cv2.imread(source_path)
        if source_img is None:
            raise ValueError("Failed to load source image")
            
        for i, target_path in enumerate(target_paths):
            async def send_progress(step_name, step_idx):
                steps_count = 7
                prog = int(((i + step_idx/steps_count) / total_targets) * 100)
                eta = (total_targets - i) * 5 - step_idx
                await manager.send_personal_message({
                    "status": "processing",
                    "progress": prog,
                    "step": f"Processing image {i+1}/{total_targets}: {step_name}",
                    "eta_seconds": max(0, eta)
                }, job_id)
                await asyncio.sleep(0.1) # Give loop time to send

            # 1. Face Detection & Swap
            await send_progress("Face Detection & Swap", 1)
            target_img = cv2.imread(target_path)
            if target_img is None:
                continue
                
            swapped_img, target_face = swap_face(source_img, target_img)
            
            # 2. Restoration
            await send_progress("Restoration", 3)
            restoration_weight = settings.get("restorationStrength", 70) / 100.0
            restored_img = restore_face(swapped_img, weight=restoration_weight)
            
            # Get face mask
            landmarks = getattr(target_face, 'landmark_2d_106', None)
            if landmarks is not None:
                # 3. Blending and masking prep
                await send_progress("Blending Mask", 4)
                feather = settings.get("blendingSmoothness", 20)
                mask = create_soft_mask(landmarks, target_img.shape, feather)
                
                # 4. Color Match
                await send_progress("Color Match", 5)
                if settings.get("colorMatch", True):
                    restored_img = match_skin_tone(restored_img, target_img, mask)
                    
                # 5. Seamless Blending
                await send_progress("Blending", 6)
                final_img = seamless_blend(restored_img, target_img, mask)
                
                # 6. Unsharp Mask
                await send_progress("Final Render", 7)
                if settings.get("sharpenFace", True):
                    final_img = apply_unsharp_mask(final_img, mask, amount=1.5, radius=1.0)
            else:
                final_img = restored_img
                
            # Save Output
            output_filename = f"result_{os.path.basename(target_path)}"
            if settings.get("format", "jpeg") == "png":
                output_filename = os.path.splitext(output_filename)[0] + ".png"
                
            output_path = os.path.join(OUTPUT_DIR, job_id, output_filename)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            if output_filename.endswith(".png"):
                cv2.imwrite(output_path, final_img)
            else:
                cv2.imwrite(output_path, final_img, [cv2.IMWRITE_JPEG_QUALITY, 97])

        await manager.send_personal_message({
            "status": "completed",
            "progress": 100,
            "step": "Finished",
            "eta_seconds": 0
        }, job_id)
        
    except Exception as e:
        await manager.send_personal_message({
            "status": "error",
            "message": str(e)
        }, job_id)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/swap/single")
async def swap_single(
    source_image: UploadFile = File(...),
    target_image: UploadFile = File(...),
    settings: str = Form(...)
):
    job_id = str(uuid.uuid4())
    job_upload_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)
    
    source_path = os.path.join(job_upload_dir, source_image.filename)
    target_path = os.path.join(job_upload_dir, target_image.filename)
    
    with open(source_path, "wb") as buffer:
        shutil.copyfileobj(source_image.file, buffer)
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(target_image.file, buffer)
        
    settings_dict = json.loads(settings)
    
    asyncio.create_task(process_swap_job(job_id, source_path, [target_path], settings_dict))
    
    return {"job_id": job_id}

@app.post("/api/swap/batch")
async def swap_batch(
    source_image: UploadFile = File(...),
    target_images: List[UploadFile] = File(...),
    settings: str = Form(...)
):
    job_id = str(uuid.uuid4())
    job_upload_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)
    
    source_path = os.path.join(job_upload_dir, source_image.filename)
    with open(source_path, "wb") as buffer:
        shutil.copyfileobj(source_image.file, buffer)
        
    target_paths = []
    for target in target_images:
        t_path = os.path.join(job_upload_dir, target.filename)
        with open(t_path, "wb") as buffer:
            shutil.copyfileobj(target.file, buffer)
        target_paths.append(t_path)
        
    settings_dict = json.loads(settings)
    
    asyncio.create_task(process_swap_job(job_id, source_path, target_paths, settings_dict))
    
    return {"job_id": job_id}

@app.websocket("/ws/job/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(websocket, job_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(job_id)

@app.get("/api/job/{job_id}/results")
def get_job_results(job_id: str):
    job_output_dir = os.path.join(OUTPUT_DIR, job_id)
    if not os.path.exists(job_output_dir):
        return {"results": []}
    
    results = []
    for filename in os.listdir(job_output_dir):
        results.append({
            "url": f"/outputs/{job_id}/{filename}",
            "filename": filename
        })
    return {"results": results}

@app.get("/api/job/{job_id}/download-zip")
def download_zip(job_id: str):
    job_output_dir = os.path.join(OUTPUT_DIR, job_id)
    if not os.path.exists(job_output_dir):
        return JSONResponse(status_code=404, content={"message": "Job not found"})
        
    zip_filename = f"{job_id}.zip"
    zip_path = os.path.join(OUTPUT_DIR, zip_filename)
    
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for root, _, files in os.walk(job_output_dir):
            for file in files:
                zipf.write(os.path.join(root, file), file)
                
    return FileResponse(zip_path, media_type="application/zip", filename="faceswap_results.zip")

from fastapi.staticfiles import StaticFiles
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
