import cv2
import numpy as np
from scipy.ndimage import gaussian_filter

def create_soft_mask(face_landmarks, image_shape, feather_radius=20):
    """
    Creates a soft gaussian feathered mask from face landmarks.
    """
    mask = np.zeros(image_shape[:2], dtype=np.uint8)
    # Get the convex hull of the landmarks
    points = np.array(face_landmarks, np.int32)
    convexhull = cv2.convexHull(points)
    cv2.fillConvexPoly(mask, convexhull, 255)
    
    # Erode the mask slightly to ensure we don't grab background
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.erode(mask, kernel, iterations=1)
    
    # Apply Gaussian blur for feathering
    if feather_radius > 0:
        # Gaussian filter needs sigma. feather_radius ~ 3*sigma
        sigma = feather_radius / 3.0
        mask_float = mask.astype(np.float32) / 255.0
        mask_blurred = gaussian_filter(mask_float, sigma=sigma)
        mask = (mask_blurred * 255).astype(np.uint8)
        
    return mask

def seamless_blend(swapped, original, mask):
    """
    Apply Poisson blending.
    """
    # Find bounding box of mask to determine center
    y_indices, x_indices = np.where(mask > 0)
    if len(y_indices) == 0 or len(x_indices) == 0:
        return swapped
        
    y1, y2 = np.min(y_indices), np.max(y_indices)
    x1, x2 = np.min(x_indices), np.max(x_indices)
    center = ((x1 + x2) // 2, (y1 + y2) // 2)
    
    # Seamless clone
    try:
        blended = cv2.seamlessClone(swapped, original, mask, center, cv2.NORMAL_CLONE)
        return blended
    except Exception as e:
        # Fallback to alpha blending if seamless fails
        mask_3d = np.expand_dims(mask / 255.0, axis=2)
        blended = swapped * mask_3d + original * (1 - mask_3d)
        return blended.astype(np.uint8)

def apply_unsharp_mask(image, mask, amount=1.5, radius=1.0, threshold=0):
    """
    Applies unsharp mask only to the region specified by mask.
    """
    blurred = cv2.GaussianBlur(image, (0, 0), radius)
    sharpened = float(amount + 1) * image - float(amount) * blurred
    sharpened = np.maximum(sharpened, np.zeros(sharpened.shape))
    sharpened = np.minimum(sharpened, 255 * np.ones(sharpened.shape))
    sharpened = sharpened.round().astype(np.uint8)
    
    if threshold > 0:
        low_contrast_mask = np.absolute(image - blurred) < threshold
        np.copyto(sharpened, image, where=low_contrast_mask)
        
    mask_3d = np.expand_dims(mask / 255.0, axis=2)
    result = sharpened * mask_3d + image * (1 - mask_3d)
    
    return result.astype(np.uint8)
