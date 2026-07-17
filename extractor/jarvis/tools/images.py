"""
Cloudinary image uploader for JARVIS.
Downloads image from source URL, uploads to Cloudinary, returns CDN URL.
"""
import logging
import cloudinary
import cloudinary.uploader
from ..config import CLOUDINARY_CLOUD, CLOUDINARY_KEY, CLOUDINARY_SECRET

logger = logging.getLogger(__name__)

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD,
    api_key=CLOUDINARY_KEY,
    api_secret=CLOUDINARY_SECRET,
    secure=True,
)


async def upload_image(source_url: str, public_id: str) -> str | None:
    """
    Upload an image from source_url to Cloudinary.
    public_id: e.g. "projects/sobha-orbis-0"
    Returns Cloudinary secure URL or None on failure.
    """
    for attempt in range(3):
        try:
            result = cloudinary.uploader.upload(
                source_url,
                public_id=public_id,
                overwrite=False,
                resource_type="image",
                folder="projects",
                transformation=[
                    {"width": 1200, "crop": "limit", "quality": "auto:good", "fetch_format": "auto"}
                ],
            )
            url = result.get("secure_url")
            if url:
                logger.info(f"Uploaded {public_id} → {url}")
                return url
        except Exception as e:
            logger.warning(f"Upload attempt {attempt + 1} failed for {public_id}: {e}")
            if attempt < 2:
                import asyncio
                await asyncio.sleep(5)

    logger.error(f"All upload attempts failed for {public_id}")
    return None


async def upload_project_images(
    slug: str,
    main_url: str | None,
    gallery_urls: list[str],
    max_gallery: int = 10,
) -> tuple[str | None, list[str]]:
    """
    Upload main image + up to max_gallery gallery images.
    Skips images smaller than 300×200 (icons/checkmarks from opr.ae).
    Returns (main_cloudinary_url, gallery_cloudinary_urls).
    Falls back to original URL if upload fails.
    """
    main_cloud = None
    if main_url:
        main_cloud = await upload_image(main_url, f"projects/{slug}-main")
        if not main_cloud:
            main_cloud = main_url

    gallery_cloud = []
    idx = 0
    for url in gallery_urls:
        if len(gallery_cloud) >= max_gallery:
            break
        try:
            result = cloudinary.uploader.upload(
                url,
                public_id=f"projects/{slug}-{idx}",
                overwrite=False,
                resource_type="image",
                folder="projects",
                transformation=[
                    {"width": 1200, "crop": "limit", "quality": "auto:good", "fetch_format": "auto"}
                ],
            )
            w = result.get("width", 0) or 0
            h = result.get("height", 0) or 0
            cloud_url = result.get("secure_url")
            if cloud_url and w >= 300 and h >= 200:
                gallery_cloud.append(cloud_url)
                idx += 1
            elif cloud_url:
                logger.info(f"Skipped small image for {slug} ({w}x{h}) — likely an icon")
            else:
                gallery_cloud.append(url)
                idx += 1
        except Exception as e:
            logger.warning(f"Gallery upload failed for {slug} image {idx}: {e}")
            gallery_cloud.append(url)
            idx += 1

    return main_cloud, gallery_cloud
