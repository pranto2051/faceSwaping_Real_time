import cv2
import numpy as np

_gfpganer = None

def get_restorer():
    global _gfpganer
    if _gfpganer is None:
        try:
            from gfpgan import GFPGANer
            _gfpganer = GFPGANer(
                model_path='https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth',
                upscale=1,
                arch='clean',
                channel_multiplier=2,
                bg_upsampler=None
            )
        except Exception as e:
            print("GFPGAN not available, skipping restoration:", e)
            _gfpganer = "dummy"
    return _gfpganer

def restore_face(img, weight=0.7):
    restorer = get_restorer()
    if restorer == "dummy" or restorer is None:
        return img
    
    # We apply GFPGAN on the whole image (it internally detects faces and restores them)
    _, _, restored_img = restorer.enhance(img, has_aligned=False, only_center_face=False, paste_back=True)
    
    # Blend with original based on weight (to preserve some original texture)
    if restored_img is not None:
        restored_img = cv2.addWeighted(restored_img, weight, img, 1.0 - weight, 0)
        return restored_img
    return img
