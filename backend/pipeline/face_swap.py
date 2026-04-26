import cv2
import numpy as np

try:
    import insightface
    from insightface.app import FaceAnalysis
    HAS_INSIGHTFACE = True
except ImportError:
    HAS_INSIGHTFACE = False

# Global singletons

_face_analyzer = None
_swapper = None

def get_face_analyzer():
    global _face_analyzer
    if _face_analyzer is None:
        _face_analyzer = FaceAnalysis(name='buffalo_l')
        _face_analyzer.prepare(ctx_id=0, det_size=(640, 640))
    return _face_analyzer

def get_swapper():
    global _swapper
    if _swapper is None:
        _swapper = insightface.model_zoo.get_model('models/inswapper_128.onnx', download=False, download_zip=False)
    return _swapper

def get_face(img_data):
    analyzer = get_face_analyzer()
    faces = analyzer.get(img_data)
    if len(faces) == 0:
        raise ValueError("No face detected")
    # Return the largest face by bounding box area
    return max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))

def swap_face(source_img, target_img):
    if not HAS_INSIGHTFACE:
        # Dummy fallback: just return target image and fake face landmarks
        class FakeFace:
            landmark_2d_106 = None
        return target_img, FakeFace()
        
    try:
        source_face = get_face(source_img)
    except Exception as e:
        raise ValueError("Could not find face in source image")
        
    try:
        target_face = get_face(target_img)
    except Exception as e:
        raise ValueError("Could not find face in target image")
        
    swapper = get_swapper()
    res = swapper.get(target_img, target_face, source_face, paste_back=True)
    
    return res, target_face
