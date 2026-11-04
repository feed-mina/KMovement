import json
from pathlib import Path
from io import BytesIO

import pytest
from PIL import Image

from src.api import kpop_image_matcher as matcher


def test_unconfigured_engine_is_not_reported_as_a_successful_empty_search(monkeypatch):
    monkeypatch.delenv('KPOP_PRODUCT_IMAGE_MANIFEST', raising=False)
    result = matcher.analyze_product_image('kpop-analysis/42/photo.jpg', 'bag')
    assert result['availability'] == 'MODEL_NOT_CONFIGURED'
    assert result['candidates'] == []
    assert 'sourceKey' not in result


def test_catalog_rejects_reference_escape_and_excludes_unlicensed_images(tmp_path):
    manifest = tmp_path / 'catalog.json'
    manifest.write_text(json.dumps([{'productRef': '1', 'rightsChecked': False, 'image': 'missing.jpg', 'itemCategory': 'bag'}]))
    assert matcher.load_catalog(manifest) == []
    outside = tmp_path.parent / 'outside.jpg'
    manifest.write_text(json.dumps([{'productRef': '1', 'rightsChecked': True, 'image': '../outside.jpg', 'itemCategory': 'bag'}]))
    with pytest.raises(ValueError, match='inside'):
        matcher.load_catalog(manifest)


def test_image_decoding_checks_bytes_and_strips_metadata():
    buffer = BytesIO()
    Image.new('RGB', (8, 8), 'red').save(buffer, format='PNG')
    image = matcher.read_image(buffer.getvalue())
    assert image.mode == 'RGB'
    with pytest.raises(ValueError, match='size'):
        matcher.read_image(b'x' * (matcher.MAX_BYTES + 1))


def test_rank_returns_only_unique_similar_refs_without_names_or_identity(tmp_path):
    np = pytest.importorskip('numpy')
    red = tmp_path / 'red.png'; blue = tmp_path / 'blue.png'
    Image.new('RGB', (8, 8), 'red').save(red)
    Image.new('RGB', (8, 8), 'blue').save(blue)
    rows = [{'productRef': 'catalog:1', 'path': red}, {'productRef': 'catalog:1', 'path': red}, {'productRef': 'catalog:2', 'path': blue}]

    def encode(images):
        values = np.array([image.getpixel((0, 0)) for image in images], dtype=float)
        return values / np.linalg.norm(values, axis=1, keepdims=True)

    result = matcher.rank_images(Image.new('RGB', (8, 8), 'red'), rows, encode, .5)
    assert len(result) == 1
    assert result[0]['productRef'] == 'catalog:1'
    assert result[0]['evidenceGrade'] == 'SIMILAR'
    assert result[0]['confidence'] == 0
    assert 'name' not in result[0]
    assert 'artistId' not in result[0]


def test_ready_configuration_with_no_selected_category_does_not_fetch_private_source(tmp_path, monkeypatch):
    manifest = tmp_path / 'catalog.json'; manifest.write_text('[]')
    checkpoint = tmp_path / 'model.bin'; checkpoint.write_bytes(b'not loaded')
    monkeypatch.setenv('KPOP_PRODUCT_IMAGE_MANIFEST', str(manifest))
    monkeypatch.setenv('KPOP_IMAGE_MODEL_CHECKPOINT', str(checkpoint))
    monkeypatch.setenv('KPOP_IMAGE_SOURCE_BUCKET', 'private-example')
    result = matcher.analyze_product_image('kpop-analysis/42/photo.jpg', 'bag')
    assert result['availability'] == 'CATALOG_EMPTY'
