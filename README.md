# FaceSwap Studio

![FaceSwap Studio Demo](demo.png)

A production-grade, photorealistic Face Swap Studio web application designed for professional photography studios. 
Powered by InsightFace (`inswapper_128.onnx`), GFPGAN/CodeFormer, and FastAPI.

## Features
- **High-Precision Face Swap**: Uses the industry-leading InsightFace model for robust face detection and sub-pixel alignment.
- **Face Restoration**: Integrates CodeFormer/GFPGAN to bring back fine details (skin texture, pores, eyelashes).
- **Seamless Blending & Color Matching**: Applies LAB color space transfer and Poisson seamless blending for natural, invisible edges.
- **Batch Processing**: Swap faces across multiple images at once.
- **Original Resolution**: Preserves original image quality with no downscaling.
- **GPU Accelerated**: Full support for NVIDIA CUDA (on Linux/Windows) and Apple Silicon (on Mac).

## Installation & Setup

### 1. Prerequisites
- **Python 3.10+**
- **Node.js & npm**

### 2. Backend Setup
Navigate to the backend directory and run these commands:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install all required Python libraries
pip install fastapi uvicorn python-multipart websockets insightface onnxruntime opencv-python-headless numpy Pillow gfpgan tqdm requests scipy
```

#### Required Python Libraries:
- **fastapi**: Modern, fast (high-performance) web framework.
- **uvicorn**: ASGI server for production.
- **insightface**: State-of-the-art face analysis library.
- **onnxruntime**: High-performance scoring engine for ONNX models.
- **gfpgan**: Blind face restoration algorithm.
- **opencv-python-headless**: Computer vision library.
- **numpy**: Numerical computing.
- **Pillow**: Image processing.

### 3. Frontend Setup
Navigate to the frontend directory and run these commands:

```bash
cd frontend
npm install
npm run dev
```

## Running the Application

### Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Start Frontend
```bash
cd frontend
npm run dev
```

The application will be available at:
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)

---

## Model Details
The application will attempt to auto-download models. If it fails, place them in `backend/models/`:
- `inswapper_128.onnx`: InsightFace face swapper model.
- `CodeFormer` / `GFPGAN` weights: For face restoration.
- `buffalo_l`: Face detection and recognition model.

## Troubleshooting
- **Mac (Apple Silicon)**: Use `onnxruntime` (which I've included in the install command). It works great with CoreML.
- **Windows/Linux with NVIDIA GPU**: You may want to install `onnxruntime-gpu` instead of `onnxruntime` for faster processing.
- **Out of Memory**: High-resolution processing may consume significant VRAM. If it crashes, try lowering the input resolution.
