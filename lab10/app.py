import io
import os
import urllib.request
import urllib.parse
import json

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request
from huggingface_hub import InferenceClient
from PIL import Image

# Загружаем переменные окружения из файла .env
load_dotenv(override=True)

app = Flask(__name__)

# Идентификатор модели на Hugging Face для генерации изображений
MODEL_ID = "black-forest-labs/FLUX.1-schnell"
MIN_SIZE = 256
MAX_SIZE = 1024
JPEG_QUALITY = 88


def translate_to_english(text):
    # Проверяем, есть ли в тексте кириллица
    has_cyrillic = any('\u0400' <= char <= '\u04FF' for char in text)
    if not has_cyrillic:
        return text
    try:
        url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            translated = "".join([item[0] for item in data[0] if item[0]])
            return translated
    except Exception as e:
        print(f"Ошибка перевода: {e}")
        return text


@app.get("/login")
def login():
    # Возвращаем JSON с логином автора
    return jsonify({"author": "1167133"})


@app.get("/makeimage")
def makeimage_form():
    # Отображаем форму генерации изображений
    return render_template("makeimage.html", message=None)


@app.post("/makeimage")
def makeimage_submit():
    # Обрабатываем отправку формы
    width_raw = request.form.get("width", "")
    height_raw = request.form.get("height", "")
    text = request.form.get("text", "").strip()

    try:
        width = int(width_raw)
        height = int(height_raw)
    except ValueError:
        return render_makeimage_error("Неверный размер изображения")

    if width <= 0 or height <= 0:
        return render_makeimage_error("Неверный размер изображения")

    # Ширина и высота должны быть кратны 32
    if width % 32 != 0 or height % 32 != 0:
        return render_makeimage_error("Ширина и высота должны быть кратны 32")

    # Проверяем диапазон размеров
    if width < MIN_SIZE or height < MIN_SIZE or width > MAX_SIZE or height > MAX_SIZE:
        return render_makeimage_error("Неверный размер изображения")

    # Текстовый промпт не должен быть пустым
    if not text:
        return render_makeimage_error("Не удалось сгенерировать изображение: пустой промпт")

    # Проверяем наличие токена Hugging Face
    token = os.getenv("HF_API_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")
    if not token:
        return render_makeimage_error("Не удалось сгенерировать изображение: API токен Hugging Face не настроен")

    # Переводим текст на английский язык, если в нём есть русский
    text_en = translate_to_english(text)

    try:
        # Генерируем картинку с помощью модели
        image = generate_image(text_en, width, height, token)
        jpeg_bytes = image_to_jpeg(image, width, height)
    except Exception as exc:
        return render_makeimage_error(f"Ошибка генерации модели: {exc}")

    # Возвращаем готовую JPEG картинку с правильным mimetype
    return Response(jpeg_bytes, mimetype="image/jpeg")


def render_makeimage_error(message):
    # Вспомогательная функция для отображения страницы с ошибкой
    return render_template(
        "makeimage.html",
        message=message,
        width=request.form.get("width", ""),
        height=request.form.get("height", ""),
        text=request.form.get("text", ""),
    )


def generate_image(prompt, width, height, token):
    # Запрос к API Hugging Face для генерации изображения
    client = InferenceClient(model=MODEL_ID, token=token, timeout=30)

    try:
        result = client.text_to_image(prompt, width=width, height=height)
    except TypeError:
        result = client.text_to_image(prompt)

    if isinstance(result, Image.Image):
        return result

    if isinstance(result, bytes):
        return Image.open(io.BytesIO(result))

    if hasattr(result, "read"):
        return Image.open(result)

    raise RuntimeError("Неожиданный ответ от модели")


def image_to_jpeg(image, width, height):
    # Преобразуем полученное изображение в JPEG формат с нужным качеством
    if image.size != (width, height):
        image = image.resize((width, height), Image.Resampling.LANCZOS)

    if image.mode != "RGB":
        image = image.convert("RGB")

    output = io.BytesIO()
    image.save(output, format="JPEG", quality=JPEG_QUALITY)
    return output.getvalue()


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=8084)
