# FaceSwap Studio

A production-grade, photorealistic Face Swap Studio web application designed for professional photography studios. 
Powered by InsightFace (`inswapper_128.onnx`), GFPGAN/CodeFormer, and FastAPI.

## Features
- **High-Precision Face Swap**: Uses the industry-leading InsightFace model for robust face detection and sub-pixel alignment.
- **Face Restoration**: Integrates CodeFormer/GFPGAN to bring back fine details (skin texture, pores, eyelashes).
- **Seamless Blending & Color Matching**: Applies LAB color space transfer and Poisson seamless blending for natural, invisible edges.
- **Batch Processing**: Swap faces across multiple images at once.
- **Original Resolution**: Preserves original image quality with no downscaling.
- **GPU Accelerated**: Full support for NVIDIA CUDA to process high-resolution images rapidly.

## Setup Instructions

### Prerequisites
- Docker and Docker Compose installed.
- NVIDIA GPU (Recommended) with NVIDIA Container Toolkit for CUDA support.

### 1. GPU Setup
To enable GPU acceleration in Docker, ensure you have installed the NVIDIA Container Toolkit.
- **Ubuntu/Debian**:
  ```bash
  sudo apt-get install -y nvidia-container-toolkit
  sudo systemctl restart docker
  ```

### 2. Model Downloads
The application will attempt to auto-download the required models on first run. Alternatively, you can download them manually and place them in the `backend/models/` directory:
- `inswapper_128.onnx`: Download from InsightFace's official release.
- `CodeFormer` weights: Download from the official CodeFormer repository.
- `buffalo_l`: Extracted by InsightFace automatically.

### 3. Installation & Running
Clone this repository and run the application using Docker Compose:

```bash
docker-compose up --build
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

### 4. Troubleshooting
- **GPU Not Found**: Ensure you have configured Docker to use the NVIDIA runtime. Check `docker-compose.yml` for the `deploy` configuration.
- **Models Failing to Download**: If the backend container fails to start due to network issues, download the models manually as described above and place them in `backend/models/`.
- **Out of Memory**: High-resolution processing may consume significant VRAM. If it crashes, try lowering the input resolution or using CPU fallback.
