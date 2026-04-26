import cv2
import numpy as np

def color_transfer(source, target):
    """
    Transfers the color distribution from the source to the target
    image using the L*a*b* color space.
    """
    source_lab = cv2.cvtColor(source, cv2.COLOR_BGR2LAB).astype("float32")
    target_lab = cv2.cvtColor(target, cv2.COLOR_BGR2LAB).astype("float32")

    (l_mean_src, l_std_src, a_mean_src, a_std_src, b_mean_src, b_std_src) = image_stats(source_lab)
    (l_mean_tar, l_std_tar, a_mean_tar, a_std_tar, b_mean_tar, b_std_tar) = image_stats(target_lab)

    (l, a, b) = cv2.split(target_lab)

    l -= l_mean_tar
    a -= a_mean_tar
    b -= b_mean_tar

    l = (l_std_tar / (l_std_src + 1e-5)) * l
    a = (a_std_tar / (a_std_src + 1e-5)) * a
    b = (b_std_tar / (b_std_src + 1e-5)) * b

    l += l_mean_src
    a += a_mean_src
    b += b_mean_src

    l = np.clip(l, 0, 255)
    a = np.clip(a, 0, 255)
    b = np.clip(b, 0, 255)

    transfer = cv2.merge([l, a, b])
    transfer = transfer.astype("uint8")
    transfer = cv2.cvtColor(transfer, cv2.COLOR_LAB2BGR)
    
    return transfer

def image_stats(image):
    (l, a, b) = cv2.split(image)
    (l_mean, l_std) = (l.mean(), l.std())
    (a_mean, a_std) = (a.mean(), a.std())
    (b_mean, b_std) = (b.mean(), b.std())
    return (l_mean, l_std, a_mean, a_std, b_mean, b_std)

def match_skin_tone(swapped_face, original_face, mask):
    """
    Apply color transfer only inside the mask region.
    """
    # Extract bounding box from mask
    y_indices, x_indices = np.where(mask > 0)
    if len(y_indices) == 0 or len(x_indices) == 0:
        return swapped_face
        
    y1, y2 = np.min(y_indices), np.max(y_indices)
    x1, x2 = np.min(x_indices), np.max(x_indices)
    
    # Crop to face region for stats
    src_crop = original_face[y1:y2, x1:x2]
    tar_crop = swapped_face[y1:y2, x1:x2]
    
    # Transfer color
    matched_crop = color_transfer(src_crop, tar_crop)
    
    # Place back
    result = swapped_face.copy()
    
    mask_crop = mask[y1:y2, x1:x2] / 255.0
    mask_crop = np.expand_dims(mask_crop, axis=2)
    
    result[y1:y2, x1:x2] = matched_crop * mask_crop + result[y1:y2, x1:x2] * (1 - mask_crop)
    
    return result
